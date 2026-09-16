from app.usecases.workspace import (
    get_default_workspace_overview,
    list_workspaces_overview,
)
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["workspace"])


@router.get("/workspaces")
def get_my_workspaces(request: Request):
    """List the current user's workspaces.

    Phase 1: always returns just the single default personal workspace. The
    frontend can treat the list as forward-compatible with multi-workspace.
    """
    current_user: User = request.state.current_user
    return list_workspaces_overview(current_user.id)


@router.get("/workspaces/default")
def get_my_default_workspace(request: Request):
    """The user's default (current) workspace; created on first access."""
    current_user: User = request.state.current_user
    return get_default_workspace_overview(current_user.id)
