from typing import Literal, Optional

from app.routes.schemas.base import BaseSchema
from pydantic import Field

TeamRoleSchema = Literal["owner", "admin", "member"]


class TeamCreateInput(BaseSchema):
    name: str = Field(min_length=1, max_length=80)


class TeamModifyInput(BaseSchema):
    name: str = Field(min_length=1, max_length=80)


class TeamInviteInput(BaseSchema):
    email: str = Field(min_length=3, max_length=254)
    role: Literal["admin", "member"] = "member"


class TeamMemberRoleInput(BaseSchema):
    role: Literal["admin", "member"]


class TeamMemberOutput(BaseSchema):
    user_id: str
    email: str
    role: TeamRoleSchema
    joined_at: float


class TeamInviteOutput(BaseSchema):
    email: str
    role: TeamRoleSchema
    invited_by: str
    create_time: float


class TeamOutput(BaseSchema):
    id: str
    name: str
    workspace_id: str
    owner_user_id: str
    # The caller's role in this team.
    my_role: TeamRoleSchema
    member_count: int
    create_time: float
    update_time: float


class TeamDetailOutput(TeamOutput):
    members: list[TeamMemberOutput]
    # Pending invitations (only returned to managers).
    invites: list[TeamInviteOutput] = []


class WorkspaceOverviewOutput(BaseSchema):
    workspace_id: str
    name: str
    kind: Literal["personal", "team"]
    is_default: bool
    team_id: Optional[str] = None
    role: Optional[TeamRoleSchema] = None
