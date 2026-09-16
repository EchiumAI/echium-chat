"""Repository for workspace metadata records.

Stored on the subscription table (a per-user control-plane table with no IAM
row-level restriction), mirroring the subscription repository's single-table
+ idempotent get-or-create pattern:

    PK = USER#{user_id}
    SK = WORKSPACE#{workspace_id}   -> WorkspaceModel

Phase 1 resolves a user's default workspace with `default_workspace_id` (a
deterministic id, no lookup needed on the hot path). This module persists the
workspace's metadata (name, kind) and is the seam where multi-workspace
creation/listing will grow.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.repositories.common import (
    default_workspace_id,
    get_subscription_table_client,
)
from app.repositories.models.workspace import WorkspaceModel

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

DEFAULT_WORKSPACE_NAME = "Personal"


def _pk(user_id: str) -> str:
    return f"USER#{user_id}"


def _ws_sk(workspace_id: str) -> str:
    return f"WORKSPACE#{workspace_id}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _item_to_model(user_id: str, workspace_id: str, item: dict) -> WorkspaceModel:
    return WorkspaceModel(
        workspace_id=workspace_id,
        owner_user_id=user_id,
        name=item.get("Name", DEFAULT_WORKSPACE_NAME),
        kind=item.get("Kind", "personal"),
        is_default=bool(item.get("IsDefault", True)),
        created_at=item.get("CreatedAt", ""),
        updated_at=item.get("UpdatedAt", ""),
    )


def get_workspace(user_id: str, workspace_id: str) -> Optional[WorkspaceModel]:
    """Fetch a workspace metadata record, or None if it doesn't exist yet."""
    table = get_subscription_table_client()
    response = table.get_item(Key={"PK": _pk(user_id), "SK": _ws_sk(workspace_id)})
    item = response.get("Item")
    if not item:
        return None
    return _item_to_model(user_id, workspace_id, item)


def get_or_create_default_workspace(user_id: str) -> WorkspaceModel:
    """Return the user's default personal workspace, creating it if absent.

    Idempotent conditional put (mirrors get_or_create_subscription) so
    concurrent first-requests don't clobber each other.
    """
    workspace_id = default_workspace_id(user_id)
    existing = get_workspace(user_id, workspace_id)
    if existing is not None:
        return existing

    now = _now_iso()
    workspace = WorkspaceModel(
        workspace_id=workspace_id,
        owner_user_id=user_id,
        name=DEFAULT_WORKSPACE_NAME,
        kind="personal",
        is_default=True,
        created_at=now,
        updated_at=now,
    )
    table = get_subscription_table_client()
    try:
        table.put_item(
            Item={
                "PK": _pk(user_id),
                "SK": _ws_sk(workspace_id),
                "Name": workspace.name,
                "Kind": workspace.kind,
                "IsDefault": workspace.is_default,
                "CreatedAt": workspace.created_at,
                "UpdatedAt": workspace.updated_at,
            },
            ConditionExpression="attribute_not_exists(SK)",
        )
        return workspace
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        # Lost the race; return the record that won.
        created = get_workspace(user_id, workspace_id)
        assert created is not None
        return created


def list_workspaces(user_id: str) -> list[WorkspaceModel]:
    """List a user's workspaces. Phase 1: always just the default one."""
    return [get_or_create_default_workspace(user_id)]
