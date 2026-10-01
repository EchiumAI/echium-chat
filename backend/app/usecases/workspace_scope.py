"""Resolve a workspace path parameter to a storage scope, enforcing access.

Every documents/folders route takes ``/workspaces/{workspace}/...`` where
``workspace`` is:

- ``default``                     the caller's personal workspace
- ``WS#TEAM#{team_id}`` or
  ``{team_id}``                   a team workspace (caller must be a member)

The scope carries the *owner key* used as the partition for storage. For a
personal workspace that is the user id; for a team it is ``TEAM#{team_id}``.
The existing workspace-document repository takes this as its ``user_id``
argument, so team data lives in the team partition without repository changes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.repositories.common import RecordAccessNotAllowedError, default_workspace_id
from app.repositories.models.team import team_owner_key, team_workspace_id
from app.repositories.team import find_member, list_team_refs

TEAM_WS_PREFIX = "WS#TEAM#"


@dataclass(frozen=True)
class WorkspaceScope:
    owner_key: str  # partition for storage (user id or TEAM#{id})
    workspace_id: str  # WS#{user} or WS#TEAM#{team}
    team_id: Optional[str] = None
    role: Optional[str] = None

    @property
    def is_team(self) -> bool:
        return self.team_id is not None


def personal_scope(user_id: str) -> WorkspaceScope:
    return WorkspaceScope(owner_key=user_id, workspace_id=default_workspace_id(user_id))


def team_id_from_param(workspace: str) -> Optional[str]:
    if not workspace or workspace == "default":
        return None
    if workspace.startswith(TEAM_WS_PREFIX):
        return workspace[len(TEAM_WS_PREFIX) :]
    if workspace.startswith("WS#"):
        # Another user's personal workspace id: never resolvable here.
        return None
    return workspace


def resolve_workspace(user_id: str, workspace: str = "default") -> WorkspaceScope:
    """Map the path parameter to a scope; 403 if the caller isn't a member."""
    if (
        not workspace
        or workspace == "default"
        or workspace == default_workspace_id(user_id)
    ):
        return personal_scope(user_id)
    team_id = team_id_from_param(workspace)
    if team_id is None:
        raise RecordAccessNotAllowedError("Workspace not accessible")
    member = find_member(team_id, user_id)
    if member is None:
        raise RecordAccessNotAllowedError("You are not a member of this team")
    return WorkspaceScope(
        owner_key=team_owner_key(team_id),
        workspace_id=team_workspace_id(team_id),
        team_id=team_id,
        role=member.role,
    )


def all_scopes_for_user(user_id: str) -> list[WorkspaceScope]:
    """Personal workspace plus every team the user belongs to (for retrieval)."""
    scopes = [personal_scope(user_id)]
    for ref in list_team_refs(user_id):
        tid = ref["team_id"]
        if tid:
            scopes.append(
                WorkspaceScope(
                    owner_key=team_owner_key(tid),
                    workspace_id=team_workspace_id(tid),
                    team_id=tid,
                    role=ref.get("role"),
                )
            )
    return scopes
