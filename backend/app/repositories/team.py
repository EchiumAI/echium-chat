"""Repository for Teams (shared workspaces).

Layout on the conversation table:

    PK = TEAM#{team_id}                     (team partition; RLS prefix TEAM#{id}*)
      SK = TEAM#{team_id}#META              -> TeamModel
      SK = TEAM#{team_id}#MEMBER#{user_id}  -> TeamMemberModel
      SK = TEAM#{team_id}#INVITE#{email}    -> TeamInviteModel (pending)

    PK = {user_id}                          (user's own partition)
      SK = {user_id}#TEAMREF#{team_id}      -> pointer so a user can list teams
                                               under their own row-level scope

    PK = INVITE#{email}                     (lookup partition for pending invites)
      SK = INVITE#{email}#TEAM#{team_id}

Team documents / folders / chunks / revisions live in the team partition too,
written by the existing workspace-document repository with ``user_id`` set to
``team_owner_key(team_id)`` — no changes to that repository are needed.

Access control is enforced in the usecase layer (membership + role) BEFORE a
team-scoped client is created. The table clients used here are scoped with the
same STS session-policy mechanism as per-user access; writes into *another*
user's partition (TEAMREF for an invitee) use the public client.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from app.repositories.common import (
    CONVERSATION_TABLE_NAME,
    RecordNotFoundError,
    _get_aws_resource,
    get_conversation_table_client,
    get_conversation_table_public_client,
)
from app.repositories.models.team import (
    TeamInviteModel,
    TeamMemberModel,
    TeamModel,
    TeamRole,
    team_owner_key,
)
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)


def _team_table(team_id: str):
    """Table client scoped (via LeadingKeys) to this team's partition."""
    return _get_aws_resource(
        "dynamodb", table_name=CONVERSATION_TABLE_NAME, user_id=team_owner_key(team_id)
    ).Table(CONVERSATION_TABLE_NAME)


def _invite_pk(email: str) -> str:
    return f"INVITE#{email.lower()}"


def _meta_sk(team_id: str) -> str:
    return f"{team_owner_key(team_id)}#META"


def _member_sk(team_id: str, user_id: str) -> str:
    return f"{team_owner_key(team_id)}#MEMBER#{user_id}"


def _invite_sk(team_id: str, email: str) -> str:
    return f"{team_owner_key(team_id)}#INVITE#{email.lower()}"


def _teamref_sk(user_id: str, team_id: str) -> str:
    return f"{user_id}#TEAMREF#{team_id}"


def _dec(value: float) -> Decimal:
    return Decimal(str(value))


# --- Team ------------------------------------------------------------------ #


def store_team(team: TeamModel) -> None:
    _team_table(team.id).put_item(
        Item={
            "PK": team_owner_key(team.id),
            "SK": _meta_sk(team.id),
            "ItemType": "TEAM",
            "Name": team.name,
            "OwnerUserId": team.owner_user_id,
            "CreateTime": _dec(team.create_time),
            "UpdateTime": _dec(team.update_time),
        }
    )


def find_team_by_id(team_id: str) -> TeamModel:
    response = _team_table(team_id).get_item(
        Key={"PK": team_owner_key(team_id), "SK": _meta_sk(team_id)}
    )
    item = response.get("Item")
    if not item:
        raise RecordNotFoundError(f"Team {team_id} not found")
    return TeamModel(
        id=team_id,
        name=item.get("Name", ""),
        owner_user_id=item.get("OwnerUserId", ""),
        create_time=float(item.get("CreateTime", 0)),
        update_time=float(item.get("UpdateTime", 0)),
    )


def delete_team_partition(team_id: str) -> None:
    """Delete every item in the team partition (meta, members, invites, docs…)."""
    table = _team_table(team_id)
    pk = team_owner_key(team_id)
    kwargs: dict = {
        "KeyConditionExpression": Key("PK").eq(pk),
        "ProjectionExpression": "SK",
    }
    keys: list[str] = []
    while True:
        response = table.query(**kwargs)
        keys.extend(item["SK"] for item in response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    if keys:
        with table.batch_writer() as batch:
            for sk in keys:
                batch.delete_item(Key={"PK": pk, "SK": sk})


# --- Members --------------------------------------------------------------- #


def _item_to_member(item: dict) -> TeamMemberModel:
    return TeamMemberModel(
        team_id=item.get("TeamId", ""),
        user_id=item.get("UserId", ""),
        email=item.get("Email", ""),
        role=item.get("Role", "member"),
        joined_at=float(item.get("JoinedAt", 0)),
    )


def store_member(member: TeamMemberModel, team_name: str) -> None:
    """Write the membership in the team partition and the TEAMREF pointer in
    the member's own partition (public client: it is another user's row)."""
    _team_table(member.team_id).put_item(
        Item={
            "PK": team_owner_key(member.team_id),
            "SK": _member_sk(member.team_id, member.user_id),
            "ItemType": "TEAM_MEMBER",
            "TeamId": member.team_id,
            "UserId": member.user_id,
            "Email": member.email,
            "Role": member.role,
            "JoinedAt": _dec(member.joined_at),
        }
    )
    get_conversation_table_public_client().put_item(
        Item={
            "PK": member.user_id,
            "SK": _teamref_sk(member.user_id, member.team_id),
            "ItemType": "TEAM_REF",
            "TeamId": member.team_id,
            "TeamName": team_name,
            "Role": member.role,
            "JoinedAt": _dec(member.joined_at),
        }
    )


def find_member(team_id: str, user_id: str) -> TeamMemberModel | None:
    response = _team_table(team_id).get_item(
        Key={"PK": team_owner_key(team_id), "SK": _member_sk(team_id, user_id)}
    )
    item = response.get("Item")
    return _item_to_member(item) if item else None


def list_members(team_id: str) -> list[TeamMemberModel]:
    pk = team_owner_key(team_id)
    response = _team_table(team_id).query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with(f"{pk}#MEMBER#")
    )
    members = [_item_to_member(i) for i in response.get("Items", [])]
    members.sort(key=lambda m: m.joined_at)
    return members


def update_member_role(team_id: str, user_id: str, role: TeamRole) -> None:
    _team_table(team_id).update_item(
        Key={"PK": team_owner_key(team_id), "SK": _member_sk(team_id, user_id)},
        UpdateExpression="SET #r = :r",
        ExpressionAttributeNames={"#r": "Role"},
        ExpressionAttributeValues={":r": role},
    )
    get_conversation_table_public_client().update_item(
        Key={"PK": user_id, "SK": _teamref_sk(user_id, team_id)},
        UpdateExpression="SET #r = :r",
        ExpressionAttributeNames={"#r": "Role"},
        ExpressionAttributeValues={":r": role},
    )


def delete_member(team_id: str, user_id: str) -> None:
    _team_table(team_id).delete_item(
        Key={"PK": team_owner_key(team_id), "SK": _member_sk(team_id, user_id)}
    )
    get_conversation_table_public_client().delete_item(
        Key={"PK": user_id, "SK": _teamref_sk(user_id, team_id)}
    )


def update_team_name_refs(team_id: str, name: str, members: list[TeamMemberModel]):
    table = get_conversation_table_public_client()
    for m in members:
        table.update_item(
            Key={"PK": m.user_id, "SK": _teamref_sk(m.user_id, team_id)},
            UpdateExpression="SET TeamName = :n",
            ExpressionAttributeValues={":n": name},
        )


def list_team_refs(user_id: str) -> list[dict]:
    """Teams a user belongs to, read under their own row-level scope."""
    table = get_conversation_table_client(user_id)
    response = table.query(
        KeyConditionExpression=Key("PK").eq(user_id)
        & Key("SK").begins_with(f"{user_id}#TEAMREF#")
    )
    return [
        {
            "team_id": i.get("TeamId", ""),
            "name": i.get("TeamName", ""),
            "role": i.get("Role", "member"),
            "joined_at": float(i.get("JoinedAt", 0)),
        }
        for i in response.get("Items", [])
    ]


# --- Invites --------------------------------------------------------------- #


def _item_to_invite(item: dict) -> TeamInviteModel:
    return TeamInviteModel(
        team_id=item.get("TeamId", ""),
        email=item.get("Email", ""),
        role=item.get("Role", "member"),
        invited_by=item.get("InvitedBy", ""),
        create_time=float(item.get("CreateTime", 0)),
    )


def store_invite(invite: TeamInviteModel, team_name: str) -> None:
    email = invite.email.lower()
    common = {
        "ItemType": "TEAM_INVITE",
        "TeamId": invite.team_id,
        "TeamName": team_name,
        "Email": email,
        "Role": invite.role,
        "InvitedBy": invite.invited_by,
        "CreateTime": _dec(invite.create_time),
    }
    _team_table(invite.team_id).put_item(
        Item={
            "PK": team_owner_key(invite.team_id),
            "SK": _invite_sk(invite.team_id, email),
            **common,
        }
    )
    get_conversation_table_public_client().put_item(
        Item={
            "PK": _invite_pk(email),
            "SK": f"{_invite_pk(email)}#TEAM#{invite.team_id}",
            **common,
        }
    )


def list_invites(team_id: str) -> list[TeamInviteModel]:
    pk = team_owner_key(team_id)
    response = _team_table(team_id).query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with(f"{pk}#INVITE#")
    )
    return [_item_to_invite(i) for i in response.get("Items", [])]


def find_invites_for_email(email: str) -> list[TeamInviteModel]:
    pk = _invite_pk(email)
    response = get_conversation_table_public_client().query(
        KeyConditionExpression=Key("PK").eq(pk)
    )
    return [_item_to_invite(i) for i in response.get("Items", [])]


def delete_invite(team_id: str, email: str) -> None:
    email = email.lower()
    _team_table(team_id).delete_item(
        Key={"PK": team_owner_key(team_id), "SK": _invite_sk(team_id, email)}
    )
    get_conversation_table_public_client().delete_item(
        Key={"PK": _invite_pk(email), "SK": f"{_invite_pk(email)}#TEAM#{team_id}"}
    )
