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
from app.repositories.common import RecordNotFoundError, default_workspace_id
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
    DocumentContentOutput,
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


def _reindex_document_embeddings(
    user_id: str, doc: WorkspaceDocumentModel, text: str
) -> None:
    """Re-embed a document's text into chunk items (RAG Phase B).

    Best-effort and gated by the WORKSPACE_RETRIEVER flag: a failure here must
    never break the document write. Chunks copy the document's visibility so the
    retriever can scope results exactly like direct injection does.
    """
    from app.repositories.workspace_document import (
        DocumentChunkRecord,
        delete_document_chunks,
        store_document_chunks,
    )
    from app.usecases.embeddings import chunk_text, embed_texts, embeddings_enabled

    if not embeddings_enabled():
        return
    try:
        delete_document_chunks(user_id, doc.id)
        chunks = chunk_text(text)
        if not chunks:
            return
        vectors = embed_texts(chunks)
        records = [
            DocumentChunkRecord(
                doc_id=doc.id,
                chunk_index=i,
                text=chunk,
                vector=vectors[i],
                filename=doc.filename,
                source=doc.source,
                source_conversation_id=doc.source_conversation_id,
                allowed_agent_ids=doc.allowed_agent_ids,
                all_agents=doc.all_agents,
            )
            for i, chunk in enumerate(chunks)
        ]
        store_document_chunks(user_id, records)
        logger.info(f"Indexed {len(records)} embedding chunks for document {doc.id}")
    except Exception:
        logger.warning(
            f"Failed to index embeddings for document {doc.id}", exc_info=True
        )


SYSTEM_SUMMARY_FOLDER_ID = "system-chat-summaries"


def _ensure_summary_folder(user_id: str, workspace_id: str) -> None:
    """Idempotently ensure the system 'Chat summaries' folder exists."""
    store_document_folder(
        user_id,
        DocumentFolderModel(
            id=SYSTEM_SUMMARY_FOLDER_ID,
            workspace_id=workspace_id,
            name="Chat summaries",
            parent_folder_id=None,
            is_system=True,
            create_time=float(get_current_time()),
        ),
    )


def upsert_chat_summary_document(
    user_id: str,
    conversation_id: str,
    summary_text: str,
    title: str = "",
    origin_agent_id: str | None = None,
) -> None:
    """Store/update a conversation's summary as a system document (M5).

    One doc per conversation (deterministic id), filed under the system
    'Chat summaries' folder.

    Sharing scope: by default a summary is visible only to the agent whose chat
    produced it (``origin_agent_id``); a summary from a plain, non-agent chat is
    visible only to plain chat. It is NOT shared across all the user's agents.
    The user can widen this later with the document share dialog (which sets
    ``all_agents`` / ``allowed_agent_ids``); that choice is preserved across
    re-summarization and never reset here.
    """
    workspace_id = default_workspace_id(user_id)
    now = float(get_current_time())
    _ensure_summary_folder(user_id, workspace_id)
    doc_id = f"summary-{conversation_id}"
    text_s3_key = _text_key(workspace_id, doc_id)
    s3_client.put_object(
        Bucket=DOCUMENT_BUCKET,
        Key=text_s3_key,
        Body=summary_text.encode("utf-8"),
    )

    # Preserve any sharing choice the user already made; only apply the default
    # (scoped to the originating agent) when the summary is first created.
    try:
        existing = find_document_by_id(user_id, doc_id)
        allowed_agent_ids = existing.allowed_agent_ids
        all_agents = existing.all_agents
        create_time = existing.create_time
    except RecordNotFoundError:
        allowed_agent_ids = [origin_agent_id] if origin_agent_id else []
        all_agents = False
        create_time = now

    doc = WorkspaceDocumentModel(
        id=doc_id,
        workspace_id=workspace_id,
        filename=f"{title or conversation_id}.md",
        s3_key="",
        text_s3_key=text_s3_key,
        content_type="text/markdown",
        size=len(summary_text.encode("utf-8")),
        source="chat_summary",
        source_conversation_id=conversation_id,
        folder_id=SYSTEM_SUMMARY_FOLDER_ID,
        allowed_agent_ids=allowed_agent_ids,
        all_agents=all_agents,
        is_system=True,
        create_time=create_time,
        update_time=now,
    )
    store_document(user_id, doc)
    _reindex_document_embeddings(user_id, doc, summary_text)


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
    _reindex_document_embeddings(user_id, doc, doc_input.extracted_text or "")
    return _to_output(doc)


def create_text_document(
    user_id: str,
    title: str,
    content: str,
    agent_id: str | None = None,
) -> WorkspaceDocumentModel:
    """Create a generated (text) document in the workspace.

    Used by the agent 'save_document' tool. Stores the text in S3 and, when an
    agent created it, auto-grants that agent access.
    """
    workspace_id = default_workspace_id(user_id)
    now = float(get_current_time())
    doc_id = str(ULID())
    text_s3_key = _text_key(workspace_id, doc_id)
    s3_client.put_object(
        Bucket=DOCUMENT_BUCKET,
        Key=text_s3_key,
        Body=content.encode("utf-8"),
    )
    safe_title = (title or "Untitled").strip()
    doc = WorkspaceDocumentModel(
        id=doc_id,
        workspace_id=workspace_id,
        filename=f"{safe_title}.md",
        s3_key="",
        text_s3_key=text_s3_key,
        content_type="text/markdown",
        size=len(content.encode("utf-8")),
        source="agent" if agent_id else "manual",
        source_conversation_id=None,
        folder_id=None,
        allowed_agent_ids=[agent_id] if agent_id else [],
        all_agents=False,
        is_system=False,
        create_time=now,
        update_time=now,
    )
    store_document(user_id, doc)
    _reindex_document_embeddings(user_id, doc, content)
    return doc


def list_documents(user_id: str) -> list[DocumentOutput]:
    workspace_id = default_workspace_id(user_id)
    return [_to_output(d) for d in find_documents_by_user_id(user_id, workspace_id)]


def get_document_content(user_id: str, doc_id: str) -> DocumentContentOutput:
    """Return a document's text and/or a presigned download URL.

    This is the contract the separate collaborative-docs editor uses to load a
    document for viewing/editing.
    """
    doc = find_document_by_id(user_id, doc_id)
    text: str | None = None
    if doc.text_s3_key:
        try:
            response = s3_client.get_object(Bucket=DOCUMENT_BUCKET, Key=doc.text_s3_key)
            text = response["Body"].read().decode("utf-8")
        except Exception:
            logger.warning(f"Failed to read doc text {doc.text_s3_key}", exc_info=True)
    download_url: str | None = None
    if doc.s3_key:
        try:
            download_url = generate_presigned_url(
                bucket=DOCUMENT_BUCKET,
                key=doc.s3_key,
                client_method="get_object",
            )
        except Exception:
            logger.warning(
                f"Failed to presign download for {doc.s3_key}", exc_info=True
            )
    return DocumentContentOutput(
        id=doc.id,
        filename=doc.filename,
        content_type=doc.content_type,
        text=text,
        download_url=download_url,
    )


def update_document_content(
    user_id: str, doc_id: str, text: str, content_type: str | None = None
) -> DocumentOutput:
    """Overwrite a document's canonical text body (write-back from the editor).

    Stores the body at the doc's text S3 key (creating one if the doc had none),
    bumps size + update_time. This is the save path for the collaborative-docs
    editor. Sharing/agent-visibility metadata is preserved.
    """
    doc = find_document_by_id(user_id, doc_id)
    workspace_id = doc.workspace_id or default_workspace_id(user_id)
    text_s3_key = doc.text_s3_key or _text_key(workspace_id, doc_id)
    body = text.encode("utf-8")
    s3_client.put_object(Bucket=DOCUMENT_BUCKET, Key=text_s3_key, Body=body)
    doc.text_s3_key = text_s3_key
    doc.size = len(body)
    if content_type:
        doc.content_type = content_type
    doc.update_time = float(get_current_time())
    store_document(user_id, doc)
    return _to_output(doc)


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
    try:
        from app.repositories.workspace_document import delete_document_chunks

        delete_document_chunks(user_id, doc_id)
    except Exception:
        logger.warning(
            f"Failed to delete embedding chunks for document {doc_id}", exc_info=True
        )


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
