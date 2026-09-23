"""Data models for the workspace document store.

Workspace documents (files uploaded manually, or captured from chats/agents)
and the folders that organize them. Both live on the conversation table like
agents and conversation-folders — cheap, no OpenSearch:

    Document:  PK=user_id, SK={user_id}#WSDOC#{doc_id},      ItemType="WORKSPACE_DOC"
    Folder:    PK=user_id, SK={user_id}#DOCFOLDER#{folder_id}, ItemType="DOCUMENT_FOLDER"
    WorkspaceId = owning workspace.

The raw file is stored in S3; extracted text (for direct injection into agent
context, Phase A RAG) is stored in S3 alongside it. Visibility to agents is a
property of the document (allowed_agent_ids / all_agents).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

DocumentSource = Literal["chat", "agent", "manual", "chat_summary"]


class WorkspaceDocumentModel(BaseModel):
    id: str
    workspace_id: str
    filename: str
    # S3 key of the raw uploaded file (empty for synthetic docs like summaries).
    s3_key: str = ""
    # S3 key of the extracted plain text used for context injection.
    text_s3_key: str = ""
    content_type: str = ""
    size: int = 0
    source: DocumentSource = "manual"
    source_conversation_id: Optional[str] = None
    # Organizing folder (None = library root).
    folder_id: Optional[str] = None
    # Visibility: explicit agent grants, or visible to every agent.
    allowed_agent_ids: list[str] = Field(default_factory=list)
    all_agents: bool = False
    # User-marked favorite (single-user workspace for now).
    is_favorite: bool = False
    # System-managed docs (e.g. chat summaries) are not user-editable/deletable.
    is_system: bool = False
    create_time: float
    update_time: float


class DocumentFolderModel(BaseModel):
    id: str
    workspace_id: str
    name: str
    parent_folder_id: Optional[str] = None
    # System folders (e.g. "Chat summaries") are auto-created and protected.
    is_system: bool = False
    create_time: float
