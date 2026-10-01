from app.routes.schemas.team import (
    TeamCreateInput,
    TeamDetailOutput,
    TeamInviteInput,
    TeamMemberRoleInput,
    TeamModifyInput,
    TeamOutput,
)
from app.usecases.team import (
    create_team,
    delete_team,
    get_team,
    invite_member,
    leave_team,
    list_my_teams,
    remove_member,
    rename_team,
    revoke_invite,
    set_member_role,
)
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["team"])


@router.get("/teams", response_model=list[TeamOutput])
def get_teams(request: Request):
    """Teams the caller belongs to (pending email invites are accepted here)."""
    user: User = request.state.current_user
    return list_my_teams(user)


@router.post("/teams", response_model=TeamOutput)
def post_team(request: Request, team_input: TeamCreateInput):
    user: User = request.state.current_user
    return create_team(user, team_input)


@router.get("/teams/{team_id}", response_model=TeamDetailOutput)
def get_single_team(request: Request, team_id: str):
    user: User = request.state.current_user
    return get_team(user, team_id)


@router.patch("/teams/{team_id}", response_model=TeamOutput)
def patch_team(request: Request, team_id: str, team_input: TeamModifyInput):
    user: User = request.state.current_user
    return rename_team(user, team_id, team_input)


@router.delete("/teams/{team_id}")
def delete_single_team(request: Request, team_id: str):
    user: User = request.state.current_user
    delete_team(user, team_id)
    return {"status": "ok"}


@router.post("/teams/{team_id}/members", response_model=TeamDetailOutput)
def post_member(request: Request, team_id: str, invite_input: TeamInviteInput):
    """Invite by email: adds immediately if the account exists, else pending."""
    user: User = request.state.current_user
    return invite_member(user, team_id, invite_input)


@router.patch(
    "/teams/{team_id}/members/{member_user_id}", response_model=TeamDetailOutput
)
def patch_member(
    request: Request, team_id: str, member_user_id: str, role_input: TeamMemberRoleInput
):
    user: User = request.state.current_user
    return set_member_role(user, team_id, member_user_id, role_input.role)


@router.delete(
    "/teams/{team_id}/members/{member_user_id}", response_model=TeamDetailOutput
)
def delete_single_member(request: Request, team_id: str, member_user_id: str):
    user: User = request.state.current_user
    return remove_member(user, team_id, member_user_id)


@router.delete("/teams/{team_id}/invites/{email}", response_model=TeamDetailOutput)
def delete_single_invite(request: Request, team_id: str, email: str):
    user: User = request.state.current_user
    return revoke_invite(user, team_id, email)


@router.post("/teams/{team_id}/leave")
def post_leave(request: Request, team_id: str):
    user: User = request.state.current_user
    leave_team(user, team_id)
    return {"status": "ok"}
