from typing import Literal

from pydantic import BaseModel

TeamRole = Literal["owner", "admin", "member"]

# Roles allowed to manage membership / settings.
MANAGER_ROLES: tuple[str, ...] = ("owner", "admin")


class TeamModel(BaseModel):
    id: str
    name: str
    owner_user_id: str
    create_time: float
    update_time: float

    @property
    def workspace_id(self) -> str:
        return team_workspace_id(self.id)


class TeamMemberModel(BaseModel):
    team_id: str
    user_id: str
    email: str
    role: TeamRole = "member"
    joined_at: float


class TeamInviteModel(BaseModel):
    team_id: str
    email: str  # lower-cased
    role: TeamRole = "member"
    invited_by: str
    create_time: float


def team_owner_key(team_id: str) -> str:
    """Partition key for everything a team owns.

    Mirrors the per-user layout (PK = owner, SK prefixed with the owner), so the
    workspace-document repository works unchanged with this as its "user_id",
    and the row-level session policy scopes access to ``TEAM#{id}*``.
    """
    return f"TEAM#{team_id}"


def team_workspace_id(team_id: str) -> str:
    return f"WS#TEAM#{team_id}"
