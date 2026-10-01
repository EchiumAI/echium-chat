from app.routes.schemas.team import WorkspaceOverviewOutput
from app.usecases.team import list_workspaces_for_user
from app.usecases.workspace_scope import resolve_workspace
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["workspace"])


@router.get("/workspaces", response_model=list[WorkspaceOverviewOutput])
def get_my_workspaces(request: Request):
    """The caller's workspaces: their personal one plus every team they are in."""
    current_user: User = request.state.current_user
    return list_workspaces_for_user(current_user)


@router.get("/workspaces/{workspace}", response_model=WorkspaceOverviewOutput)
def get_workspace(request: Request, workspace: str):
    """One workspace by id ("default", a team id, or WS#TEAM#{id})."""
    current_user: User = request.state.current_user
    scope = resolve_workspace(current_user.id, workspace)
    for ws in list_workspaces_for_user(current_user):
        if ws.workspace_id == scope.workspace_id:
            return ws
    # Personal workspace always exists.
    return WorkspaceOverviewOutput(
        workspace_id=scope.workspace_id,
        name="Personal",
        kind="personal",
        is_default=True,
    )
