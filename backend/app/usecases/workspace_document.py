"""Workspace document store usecases.

Raw files live in the shared document S3 bucket under a persistent workspace
prefix; extracted text lives alongside for direct context injection (Phase A
RAG). Metadata + folders live on the conversation table. Documents are private
by default (visible to no agent) until shared.
"""

from __future__ import annotations

import logging
import os

import boto3
from app.repositories.common import default_workspace_id
from app.repositories.models.workspace_document import (
    DocumentFolderModel,
    WorkspaceDocumentModel,
)
from app.repositories.workspace_document import (
    delete_document_by_id,
    delete_document_folder_by_id,
    find_document_by_id,
    find_document_folders_by_user_id,
    find_documents_by_user_id,
    store_document,
    store_document_folder,
)
from app.routes.schemas.workspace_document import (
    DocumentCreateInput,
    DocumentFolderCreateInput,
    DocumentFolderModifyInput,
    DocumentFolderOutput,
    DocumentModifyInput,
    DocumentOutput,
    PresignedUploadInput,
    PresignedUploadOutput,
)
from app.utils import generate_presigned_url, get_current_time
from ulid import ULID

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

DOCUMENT_BUCKET = os.environ.get("DOCUMENT_BUCKET", "documents")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
s3_client = boto3.client("s3", BEDROCK_REGION)


def _doc_prefix(workspace_id: str, doc_id: str) -> str:
    return f"workspaces/{workspace_id}/documents/{doc_id}"


def _text_key(workspace_id: str, doc_id: str) -> str:
    return f"{_doc_prefix(workspace_id, doc_id)}/text.txt"


def _to_output(doc: WorkspaceDocumentModel) -> DocumentOutput:
    return DocumentOutput(
        id=doc.id,
        workspace_id=doc.workspace_id,
        filename=doc.filename,
        content_type=doc.content_type,
        size=doc.size,
        source=doc.source,
        folder_id=doc.folder_id,
        allowed_agent_ids=doc.allowed_agent_ids,
        all_agents=doc.all_agents,
        is_system=doc.is_system,
        create_time=doc.create_time,
        update_time=doc.update_time,
    )


def _folder_to_output(folder: DocumentFolderModel) -> DocumentFolderOutput:
    return DocumentFolderOutput(
        id=folder.id,
        name=folder.name,
        parent_folder_id=folder.parent_folder_id,
        is_system=folder.is_system,
        create_time=folder.create_time,
    )


def create_presigned_upload(
    user_id: str, upload_input: PresignedUploadInput
) -> PresignedUploadOutput:
    """Mint a doc id + S3 key and return a presigned PUT URL for the raw file."""
    workspace_id = default_workspace_id(user_id)
    doc_id = str(ULID())
    s3_key = f"{_doc_prefix(workspace_id, doc_id)}/{upload_input.filename}"
    url = generate_presigned_url(
        bucket=DOCUMENT_BUCKET,
        key=s3_key,
        content_type=upload_input.content_type,
        client_method="put_object",
    )
    return PresignedUploadOutput(doc_id=doc_id, url=url, s3_key=s3_key)


def create_document(user_id: str, doc_input: DocumentCreateInput) -> DocumentOutput:
    """Finalize a manual upload: store extracted text + metadata."""
    workspace_id = default_workspace_id(user_id)
    now = float(get_current_time())

    text_s3_key = ""
    if doc_input.extracted_text:
        text_s3_key = _text_key(workspace_id, doc_input.doc_id)
        s3_client.put_object(
            Bucket=DOCUMENT_BUCKET,
            Key=text_s3_key,
            Body=doc_input.extracted_text.encode("utf-8"),
        )

    doc = WorkspaceDocumentModel(
        id=doc_input.doc_id,
        workspace_id=workspace_id,
        filename=doc_input.filename,
        s3_key=doc_input.s3_key,
        text_s3_key=text_s3_key,
        content_type=doc_input.content_type or "",
        size=doc_input.size,
        source="manual",
        source_conversation_id=None,
        folder_id=doc_input.folder_id,
        allowed_agent_ids=[],
        all_agents=False,
        is_system=False,
        create_time=now,
        update_time=now,
    )
    store_document(user_id, doc)
    return _to_output(doc)


def list_documents(user_id: str) -> list[DocumentOutput]:
    workspace_id = default_workspace_id(user_id)
    return [_to_output(d) for d in find_documents_by_user_id(user_id, workspace_id)]


def modify_document(
    user_id: str, doc_id: str, doc_input: DocumentModifyInput
) -> DocumentOutput:
    doc = find_document_by_id(user_id, doc_id)
    if doc_input.filename is not None:
        doc.filename = doc_input.filename
    if doc_input.folder_id is not None:
        # Empty string clears the folder (move to root).
        doc.folder_id = doc_input.folder_id or None
    if doc_input.allowed_agent_ids is not None:
        doc.allowed_agent_ids = doc_input.allowed_agent_ids
    if doc_input.all_agents is not None:
        doc.all_agents = doc_input.all_agents
    doc.update_time = float(get_current_time())
    store_document(user_id, doc)
    return _to_output(doc)


def persist_uploaded_attachments(
    user_id: str,
    conversation_id: str,
    agent_id: str | None,
    attachments: list,
) -> None:
    """Store files a user attached in a chat as workspace documents.

    Best-effort: never let this break the chat flow. Uploads from an agent chat
    are auto-granted to that agent; uploads from a plain chat are private.
    """
    if not attachments:
        return
    workspace_id = default_workspace_id(user_id)
    now = float(get_current_time())
    for att in attachments:
        try:
            filename = getattr(att, "file_name", None) or "attachment"
            body = getattr(att, "body", b"") or b""
            doc_id = str(ULID())
            s3_key = f"{_doc_prefix(workspace_id, doc_id)}/{filename}"
            s3_client.put_object(Bucket=DOCUMENT_BUCKET, Key=s3_key, Body=body)
            doc = WorkspaceDocumentModel(
                id=doc_id,
                workspace_id=workspace_id,
                filename=filename,
                s3_key=s3_key,
                text_s3_key="",
                content_type="",
                size=len(body),
                source="agent" if agent_id else "chat",
                source_conversation_id=conversation_id,
                folder_id=None,
                allowed_agent_ids=[agent_id] if agent_id else [],
                all_agents=False,
                is_system=False,
                create_time=now,
                update_time=now,
            )
            store_document(user_id, doc)
        except Exception:
            logger.warning(
                "Failed to persist chat attachment as workspace document",
                exc_info=True,
            )


def delete_document(user_id: str, doc_id: str) -> None:
    doc = find_document_by_id(user_id, doc_id)
    for key in (doc.s3_key, doc.text_s3_key):
        if key:
            try:
                s3_client.delete_object(Bucket=DOCUMENT_BUCKET, Key=key)
            except Exception:
                logger.warning(f"Failed to delete S3 object {key}", exc_info=True)
    delete_document_by_id(user_id, doc_id)


# --- Folders -------------------------------------------------------------- #


def create_document_folder(
    user_id: str, folder_input: DocumentFolderCreateInput
) -> DocumentFolderOutput:
    folder = DocumentFolderModel(
        id=str(ULID()),
        workspace_id=default_workspace_id(user_id),
        name=folder_input.name,
        parent_folder_id=folder_input.parent_folder_id,
        is_system=False,
        create_time=float(get_current_time()),
    )
    store_document_folder(user_id, folder)
    return _folder_to_output(folder)


def list_document_folders(user_id: str) -> list[DocumentFolderOutput]:
    workspace_id = default_workspace_id(user_id)
    return [
        _folder_to_output(f)
        for f in find_document_folders_by_user_id(user_id, workspace_id)
    ]


def modify_document_folder(
    user_id: str, folder_id: str, folder_input: DocumentFolderModifyInput
) -> DocumentFolderOutput:
    from app.repositories.workspace_document import find_document_folder_by_id

    folder = find_document_folder_by_id(user_id, folder_id)
    folder.name = folder_input.name
    store_document_folder(user_id, folder)
    return _folder_to_output(folder)


def delete_document_folder(user_id: str, folder_id: str) -> None:
    delete_document_folder_by_id(user_id, folder_id)
