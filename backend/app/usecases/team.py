"""Teams: shared workspaces with membership and roles.

Roles
- owner   created the team; can do everything incl. delete the team and change
          roles; cannot be removed.
- admin   can rename, invite, remove members (not the owner), change roles
          between admin/member.
- member  can use the team workspace (documents, boards).

Invitations are by email. If the address already belongs to a Cognito user we
add them immediately; otherwise a pending invite is stored and accepted
automatically the first time that user lists their teams after signing up.
"""

from __future__ import annotations

import logging
import os

import boto3
from app.repositories.common import RecordAccessNotAllowedError, RecordNotFoundError
from app.repositories.models.team import (
    MANAGER_ROLES,
    TeamInviteModel,
    TeamMemberModel,
    TeamModel,
    TeamRole,
    team_workspace_id,
)
from app.repositories.team import (
    delete_invite,
    delete_member,
    delete_team_partition,
    find_invites_for_email,
    find_member,
    find_team_by_id,
    list_invites,
    list_members,
    list_team_refs,
    store_invite,
    store_member,
    store_team,
    update_member_role,
    update_team_name_refs,
)
from app.routes.schemas.team import (
    TeamCreateInput,
    TeamDetailOutput,
    TeamInviteInput,
    TeamInviteOutput,
    TeamMemberOutput,
    TeamModifyInput,
    TeamOutput,
    WorkspaceOverviewOutput,
)
from app.user import User
from app.utils import get_current_time
from ulid import ULID

logger = logging.getLogger(__name__)

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
DOCUMENT_BUCKET = os.environ.get("DOCUMENT_BUCKET", "documents")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")


# --- helpers --------------------------------------------------------------- #


def _require_member(team_id: str, user_id: str) -> TeamMemberModel:
    member = find_member(team_id, user_id)
    if member is None:
        raise RecordAccessNotAllowedError("You are not a member of this team")
    return member


def _require_manager(team_id: str, user_id: str) -> TeamMemberModel:
    member = _require_member(team_id, user_id)
    if member.role not in MANAGER_ROLES:
        raise RecordAccessNotAllowedError("Only team owners and admins can do this")
    return member


def _resolve_user_sub_by_email(email: str) -> str | None:
    """Look up an existing Cognito user by exact email; return their ``sub``.

    ``User.id`` is the token ``sub`` (the storage partition key), which differs
    from ``Username`` for federated users — so read the ``sub`` attribute.
    """
    if not USER_POOL_ID:
        return None
    try:
        client = boto3.client("cognito-idp")
        resp = client.list_users(
            UserPoolId=USER_POOL_ID, Filter=f'email = "{email.lower()}"', Limit=1
        )
        users = resp.get("Users", [])
        if not users:
            return None
        attrs = {a["Name"]: a["Value"] for a in users[0].get("Attributes", [])}
        return attrs.get("sub") or users[0].get("Username")
    except Exception:  # noqa: BLE001 - fall back to a pending invite
        logger.warning("Cognito email lookup failed", exc_info=True)
        return None


def _to_output(team: TeamModel, my_role: TeamRole, member_count: int) -> TeamOutput:
    return TeamOutput(
        id=team.id,
        name=team.name,
        workspace_id=team.workspace_id,
        owner_user_id=team.owner_user_id,
        my_role=my_role,
        member_count=member_count,
        create_time=team.create_time,
        update_time=team.update_time,
    )


def _member_out(m: TeamMemberModel) -> TeamMemberOutput:
    return TeamMemberOutput(
        user_id=m.user_id, email=m.email, role=m.role, joined_at=m.joined_at
    )


def _invite_out(i: TeamInviteModel) -> TeamInviteOutput:
    return TeamInviteOutput(
        email=i.email, role=i.role, invited_by=i.invited_by, create_time=i.create_time
    )


# --- invites: auto-accept on listing -------------------------------------- #


def accept_pending_invites(user: User) -> int:
    """Turn any invites addressed to this user's email into memberships."""
    if not user.email:
        return 0
    accepted = 0
    for invite in find_invites_for_email(user.email):
        try:
            team = find_team_by_id(invite.team_id)
        except RecordNotFoundError:
            delete_invite(invite.team_id, invite.email)
            continue
        if find_member(team.id, user.id) is None:
            store_member(
                TeamMemberModel(
                    team_id=team.id,
                    user_id=user.id,
                    email=user.email.lower(),
                    role=invite.role,
                    joined_at=float(get_current_time()),
                ),
                team.name,
            )
            accepted += 1
        delete_invite(team.id, invite.email)
    return accepted


# --- teams ----------------------------------------------------------------- #


def list_my_teams(user: User) -> list[TeamOutput]:
    accept_pending_invites(user)
    out: list[TeamOutput] = []
    for ref in list_team_refs(user.id):
        try:
            team = find_team_by_id(ref["team_id"])
        except RecordNotFoundError:
            continue
        out.append(_to_output(team, ref["role"], len(list_members(team.id))))
    out.sort(key=lambda t: t.name.lower())
    return out


def create_team(user: User, team_input: TeamCreateInput) -> TeamOutput:
    now = float(get_current_time())
    team = TeamModel(
        id=str(ULID()),
        name=team_input.name.strip(),
        owner_user_id=user.id,
        create_time=now,
        update_time=now,
    )
    store_team(team)
    store_member(
        TeamMemberModel(
            team_id=team.id,
            user_id=user.id,
            email=(user.email or "").lower(),
            role="owner",
            joined_at=now,
        ),
        team.name,
    )
    logger.info(f"Team {team.id} created by {user.id}")
    return _to_output(team, "owner", 1)


def get_team(user: User, team_id: str) -> TeamDetailOutput:
    me = _require_member(team_id, user.id)
    team = find_team_by_id(team_id)
    members = list_members(team_id)
    invites = list_invites(team_id) if me.role in MANAGER_ROLES else []
    base = _to_output(team, me.role, len(members))
    return TeamDetailOutput(
        **base.model_dump(),
        members=[_member_out(m) for m in members],
        invites=[_invite_out(i) for i in invites],
    )


def rename_team(user: User, team_id: str, team_input: TeamModifyInput) -> TeamOutput:
    me = _require_manager(team_id, user.id)
    team = find_team_by_id(team_id)
    team.name = team_input.name.strip()
    team.update_time = float(get_current_time())
    store_team(team)
    members = list_members(team_id)
    update_team_name_refs(team_id, team.name, members)
    return _to_output(team, me.role, len(members))


def delete_team(user: User, team_id: str) -> None:
    me = _require_member(team_id, user.id)
    if me.role != "owner":
        raise RecordAccessNotAllowedError("Only the team owner can delete the team")
    members = list_members(team_id)
    invites = list_invites(team_id)
    # Remove pointers in each member's partition and the email invite index.
    for m in members:
        delete_member(team_id, m.user_id)
    for i in invites:
        delete_invite(team_id, i.email)
    # Team documents' S3 objects live under the team workspace prefix.
    try:
        s3 = boto3.client("s3", BEDROCK_REGION)
        prefix = f"workspaces/{team_workspace_id(team_id)}/"
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=DOCUMENT_BUCKET, Prefix=prefix):
            objs = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if objs:
                s3.delete_objects(Bucket=DOCUMENT_BUCKET, Delete={"Objects": objs})
    except Exception:  # noqa: BLE001
        logger.warning(f"Failed to purge S3 objects for team {team_id}", exc_info=True)
    delete_team_partition(team_id)
    logger.info(f"Team {team_id} deleted by {user.id}")


# --- membership ------------------------------------------------------------ #


def invite_member(user: User, team_id: str, inv: TeamInviteInput) -> TeamDetailOutput:
    _require_manager(team_id, user.id)
    team = find_team_by_id(team_id)
    email = inv.email.strip().lower()
    if "@" not in email:
        raise ValueError("Enter a valid email address")
    if any(m.email == email for m in list_members(team_id)):
        raise ValueError("That person is already a member")

    sub = _resolve_user_sub_by_email(email)
    now = float(get_current_time())
    if sub:
        store_member(
            TeamMemberModel(
                team_id=team_id, user_id=sub, email=email, role=inv.role, joined_at=now
            ),
            team.name,
        )
    else:
        store_invite(
            TeamInviteModel(
                team_id=team_id,
                email=email,
                role=inv.role,
                invited_by=user.email or user.id,
                create_time=now,
            ),
            team.name,
        )
    return get_team(user, team_id)


def revoke_invite(user: User, team_id: str, email: str) -> TeamDetailOutput:
    _require_manager(team_id, user.id)
    delete_invite(team_id, email)
    return get_team(user, team_id)


def set_member_role(
    user: User, team_id: str, member_user_id: str, role: TeamRole
) -> TeamDetailOutput:
    _require_manager(team_id, user.id)
    target = find_member(team_id, member_user_id)
    if target is None:
        raise RecordNotFoundError("Member not found")
    if target.role == "owner":
        raise RecordAccessNotAllowedError("The owner's role cannot be changed")
    update_member_role(team_id, member_user_id, role)
    return get_team(user, team_id)


def remove_member(user: User, team_id: str, member_user_id: str) -> TeamDetailOutput:
    _require_manager(team_id, user.id)
    target = find_member(team_id, member_user_id)
    if target is None:
        raise RecordNotFoundError("Member not found")
    if target.role == "owner":
        raise RecordAccessNotAllowedError("The owner cannot be removed")
    delete_member(team_id, member_user_id)
    return get_team(user, team_id)


def leave_team(user: User, team_id: str) -> None:
    me = _require_member(team_id, user.id)
    if me.role == "owner":
        raise RecordAccessNotAllowedError(
            "The owner cannot leave; delete the team or transfer ownership first"
        )
    delete_member(team_id, user.id)


# --- workspaces overview --------------------------------------------------- #


def list_workspaces_for_user(user: User) -> list[WorkspaceOverviewOutput]:
    """Personal workspace first, then each team the user belongs to."""
    from app.repositories.common import default_workspace_id

    out = [
        WorkspaceOverviewOutput(
            workspace_id=default_workspace_id(user.id),
            name="Personal",
            kind="personal",
            is_default=True,
        )
    ]
    for t in list_my_teams(user):
        out.append(
            WorkspaceOverviewOutput(
                workspace_id=t.workspace_id,
                name=t.name,
                kind="team",
                is_default=False,
                team_id=t.id,
                role=t.my_role,
            )
        )
    return out
