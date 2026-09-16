"""Data model for workspaces.

Phase 1: every user has a single default *personal* workspace, derived from
their user id (see `repositories.common.default_workspace_id`). Everything a
user owns — chats, folders, agents — is scoped to a workspace via a plain
`WorkspaceId` attribute. This model backs the workspace metadata record
(its name, kind), stored on the subscription table at:

    PK = USER#{user_id}
    SK = WORKSPACE#{workspace_id}

Multi-workspace (multiple personal + shared/corporate workspaces, memory
scoping, cross-workspace access) is a later phase; the `kind` field and the
per-record storage leave room for it without reshaping Phase-1 data.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

# Only "personal" exists in Phase 1. "shared" (team/corporate) comes later.
WorkspaceKind = Literal["personal", "shared"]


class WorkspaceModel(BaseModel):
    workspace_id: str
    owner_user_id: str
    name: str
    kind: WorkspaceKind = "personal"
    # Whether this is the user's auto-created default workspace.
    is_default: bool = True
    created_at: str
    updated_at: str
