"""Workspace usecases.

Phase 1 surfaces the user's single default personal workspace to the frontend
so the UI can scope chats/folders/agents to it. Returned as camelCase JSON.
"""

from __future__ import annotations

from app.repositories.models.workspace import WorkspaceModel
from app.repositories.workspace import (
    get_or_create_default_workspace,
    list_workspaces,
)


def _to_overview(workspace: WorkspaceModel) -> dict:
    return {
        "workspaceId": workspace.workspace_id,
        "name": workspace.name,
        "kind": workspace.kind,
        "isDefault": workspace.is_default,
    }


def get_default_workspace_overview(user_id: str) -> dict:
    """The user's current (default) workspace. Creates it on first call."""
    return _to_overview(get_or_create_default_workspace(user_id))


def list_workspaces_overview(user_id: str) -> list[dict]:
    """All workspaces the user can access. Phase 1: just the default one."""
    return [_to_overview(w) for w in list_workspaces(user_id)]
