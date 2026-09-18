from typing import Optional

from app.routes.schemas.base import BaseSchema

# --- Upload --------------------------------------------------------------- #


class PresignedUploadInput(BaseSchema):
    filename: str
    content_type: Optional[str] = None


class PresignedUploadOutput(BaseSchema):
    doc_id: str
    url: str
    s3_key: str


# --- Documents ------------------------------------------------------------ #


class DocumentCreateInput(BaseSchema):
    # doc_id + s3_key come from the presigned-upload step.
    doc_id: str
    filename: str
    s3_key: str
    content_type: Optional[str] = None
    size: int = 0
    # Client-extracted plain text (stored for context injection). Optional.
    extracted_text: Optional[str] = None
    folder_id: Optional[str] = None


class DocumentModifyInput(BaseSchema):
    # All optional: only provided fields are updated.
    filename: Optional[str] = None
    folder_id: Optional[str] = None
    allowed_agent_ids: Optional[list[str]] = None
    all_agents: Optional[bool] = None


class DocumentOutput(BaseSchema):
    id: str
    workspace_id: str
    filename: str
    content_type: str
    size: int
    source: str
    folder_id: Optional[str]
    allowed_agent_ids: list[str]
    all_agents: bool
    is_system: bool
    create_time: float
    update_time: float


# --- Folders -------------------------------------------------------------- #


class DocumentFolderCreateInput(BaseSchema):
    name: str
    parent_folder_id: Optional[str] = None


class DocumentFolderModifyInput(BaseSchema):
    name: str


class DocumentFolderOutput(BaseSchema):
    id: str
    name: str
    parent_folder_id: Optional[str]
    is_system: bool
    create_time: float


class DocumentContentOutput(BaseSchema):
    id: str
    filename: str
    content_type: str
    # Plain/Markdown text if available (generated docs, summaries, extracted).
    text: Optional[str] = None
    # Presigned GET URL for the raw file if present (for binary documents).
    download_url: Optional[str] = None
