"""Repository for the workspace document store (documents + folders).

Stored on the conversation table, mirroring the agent/folder pattern. No GSIs,
no OpenSearch — deliberately cheap.
"""

import logging
from array import array
from dataclasses import dataclass, field
from decimal import Decimal as decimal

from app.repositories.common import (
    RecordNotFoundError,
    compose_document_folder_id,
    compose_workspace_document_id,
    decompose_document_folder_id,
    decompose_workspace_document_id,
    default_workspace_id,
    get_conversation_table_client,
)
from app.repositories.models.workspace_document import (
    DocumentFolderModel,
    WorkspaceDocumentModel,
)
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# --- Documents ------------------------------------------------------------ #


def _item_to_document(user_id: str, item: dict) -> WorkspaceDocumentModel:
    return WorkspaceDocumentModel(
        id=decompose_workspace_document_id(item["SK"]),
        workspace_id=item.get("WorkspaceId") or default_workspace_id(user_id),
        filename=item.get("Filename", ""),
        s3_key=item.get("S3Key", ""),
        text_s3_key=item.get("TextS3Key", ""),
        content_type=item.get("ContentType", ""),
        size=int(item.get("Size", 0)),
        source=item.get("Source", "manual"),
        source_conversation_id=item.get("SourceConversationId"),
        folder_id=item.get("FolderId"),
        allowed_agent_ids=list(item.get("AllowedAgentIds", []) or []),
        all_agents=bool(item.get("AllAgents", False)),
        is_system=bool(item.get("IsSystem", False)),
        create_time=float(item.get("CreateTime", 0)),
        update_time=float(item.get("UpdateTime", 0)),
    )


def store_document(user_id: str, document: WorkspaceDocumentModel):
    logger.info(f"Storing workspace document {document.id} for user {user_id}")
    table = get_conversation_table_client(user_id)
    table.put_item(
        Item={
            "PK": user_id,
            "SK": compose_workspace_document_id(user_id, document.id),
            "ItemType": "WORKSPACE_DOC",
            "WorkspaceId": document.workspace_id or default_workspace_id(user_id),
            "Filename": document.filename,
            "S3Key": document.s3_key,
            "TextS3Key": document.text_s3_key,
            "ContentType": document.content_type,
            "Size": int(document.size),
            "Source": document.source,
            "SourceConversationId": document.source_conversation_id,
            "FolderId": document.folder_id,
            "AllowedAgentIds": document.allowed_agent_ids,
            "AllAgents": document.all_agents,
            "IsSystem": document.is_system,
            "CreateTime": decimal(document.create_time),
            "UpdateTime": decimal(document.update_time),
        }
    )


def find_documents_by_user_id(
    user_id: str, workspace_id: str | None = None
) -> list[WorkspaceDocumentModel]:
    table = get_conversation_table_client(user_id)
    response = table.query(
        KeyConditionExpression=Key("PK").eq(user_id)
        & Key("SK").begins_with(f"{user_id}#WSDOC#"),
        ScanIndexForward=False,
    )
    docs = [_item_to_document(user_id, item) for item in response["Items"]]
    if workspace_id is not None:
        docs = [d for d in docs if d.workspace_id == workspace_id]
    return docs


def find_document_by_id(user_id: str, doc_id: str) -> WorkspaceDocumentModel:
    table = get_conversation_table_client(user_id)
    response = table.get_item(
        Key={"PK": user_id, "SK": compose_workspace_document_id(user_id, doc_id)}
    )
    item = response.get("Item")
    if not item:
        raise RecordNotFoundError(f"Document {doc_id} not found for user {user_id}")
    return _item_to_document(user_id, item)


def delete_document_by_id(user_id: str, doc_id: str):
    table = get_conversation_table_client(user_id)
    try:
        table.delete_item(
            Key={"PK": user_id, "SK": compose_workspace_document_id(user_id, doc_id)},
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        raise RecordNotFoundError(f"Document {doc_id} not found for user {user_id}")


# --- Document embedding chunks (RAG Phase B) ------------------------------ #
#
# One item per text chunk of a workspace document, storing the chunk text and
# its embedding vector (packed float32 in a Binary attribute) plus a copy of the
# owning document's visibility so retrieval can scope without a second lookup.
# SK = "{user_id}#WSDOCCHUNK#{doc_id}#{index}" — deliberately NOT a prefix of the
# document SK ("{user_id}#WSDOC#..."), so document queries never pick up chunks.

_CHUNK_MARKER = "WSDOCCHUNK"


@dataclass
class DocumentChunkRecord:
    doc_id: str
    chunk_index: int
    text: str
    vector: list[float]
    filename: str = ""
    source: str = "manual"
    source_conversation_id: str | None = None
    allowed_agent_ids: list[str] = field(default_factory=list)
    all_agents: bool = False


def _chunk_sk(user_id: str, doc_id: str, index: int) -> str:
    return f"{user_id}#{_CHUNK_MARKER}#{doc_id}#{index:04d}"


def _chunk_doc_prefix(user_id: str, doc_id: str) -> str:
    return f"{user_id}#{_CHUNK_MARKER}#{doc_id}#"


def _chunk_user_prefix(user_id: str) -> str:
    return f"{user_id}#{_CHUNK_MARKER}#"


def _bytes_of(value) -> bytes:
    # boto3 returns binary attributes as a Binary wrapper (has `.value`).
    return value.value if hasattr(value, "value") else bytes(value)


def _item_to_chunk(item: dict) -> DocumentChunkRecord:
    vec = array("f")
    raw = _bytes_of(item.get("Vector", b""))
    if raw:
        vec.frombytes(raw)
    return DocumentChunkRecord(
        doc_id=item.get("DocId", ""),
        chunk_index=int(item.get("ChunkIndex", 0)),
        text=item.get("Text", ""),
        vector=list(vec),
        filename=item.get("Filename", ""),
        source=item.get("Source", "manual"),
        source_conversation_id=item.get("SourceConversationId"),
        allowed_agent_ids=list(item.get("AllowedAgentIds", []) or []),
        all_agents=bool(item.get("AllAgents", False)),
    )


def store_document_chunks(user_id: str, records: list[DocumentChunkRecord]) -> None:
    if not records:
        return
    table = get_conversation_table_client(user_id)
    with table.batch_writer() as batch:
        for record in records:
            batch.put_item(
                Item={
                    "PK": user_id,
                    "SK": _chunk_sk(user_id, record.doc_id, record.chunk_index),
                    "ItemType": "WORKSPACE_DOC_CHUNK",
                    "DocId": record.doc_id,
                    "ChunkIndex": record.chunk_index,
                    "Text": record.text,
                    "Vector": array("f", record.vector).tobytes(),
                    "Filename": record.filename,
                    "Source": record.source,
                    "SourceConversationId": record.source_conversation_id,
                    "AllowedAgentIds": record.allowed_agent_ids,
                    "AllAgents": record.all_agents,
                }
            )


def find_document_chunks_by_user_id(user_id: str) -> list[DocumentChunkRecord]:
    table = get_conversation_table_client(user_id)
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("PK").eq(user_id)
        & Key("SK").begins_with(_chunk_user_prefix(user_id)),
    }
    while True:
        response = table.query(**kwargs)
        items.extend(response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return [_item_to_chunk(item) for item in items]


def delete_document_chunks(user_id: str, doc_id: str) -> None:
    table = get_conversation_table_client(user_id)
    kwargs: dict = {
        "KeyConditionExpression": Key("PK").eq(user_id)
        & Key("SK").begins_with(_chunk_doc_prefix(user_id, doc_id)),
        "ProjectionExpression": "SK",
    }
    keys: list[str] = []
    while True:
        response = table.query(**kwargs)
        keys.extend(item["SK"] for item in response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    if not keys:
        return
    with table.batch_writer() as batch:
        for sk in keys:
            batch.delete_item(Key={"PK": user_id, "SK": sk})


# --- Folders -------------------------------------------------------------- #


def _item_to_folder(user_id: str, item: dict) -> DocumentFolderModel:
    return DocumentFolderModel(
        id=decompose_document_folder_id(item["SK"]),
        workspace_id=item.get("WorkspaceId") or default_workspace_id(user_id),
        name=item.get("Name", ""),
        parent_folder_id=item.get("ParentFolderId"),
        is_system=bool(item.get("IsSystem", False)),
        create_time=float(item.get("CreateTime", 0)),
    )


def store_document_folder(user_id: str, folder: DocumentFolderModel):
    logger.info(f"Storing document folder {folder.id} for user {user_id}")
    table = get_conversation_table_client(user_id)
    table.put_item(
        Item={
            "PK": user_id,
            "SK": compose_document_folder_id(user_id, folder.id),
            "ItemType": "DOCUMENT_FOLDER",
            "WorkspaceId": folder.workspace_id or default_workspace_id(user_id),
            "Name": folder.name,
            "ParentFolderId": folder.parent_folder_id,
            "IsSystem": folder.is_system,
            "CreateTime": decimal(folder.create_time),
        }
    )


def find_document_folders_by_user_id(
    user_id: str, workspace_id: str | None = None
) -> list[DocumentFolderModel]:
    table = get_conversation_table_client(user_id)
    response = table.query(
        KeyConditionExpression=Key("PK").eq(user_id)
        & Key("SK").begins_with(f"{user_id}#DOCFOLDER#"),
        ScanIndexForward=False,
    )
    folders = [_item_to_folder(user_id, item) for item in response["Items"]]
    if workspace_id is not None:
        folders = [f for f in folders if f.workspace_id == workspace_id]
    return folders


def find_document_folder_by_id(user_id: str, folder_id: str) -> DocumentFolderModel:
    table = get_conversation_table_client(user_id)
    response = table.get_item(
        Key={"PK": user_id, "SK": compose_document_folder_id(user_id, folder_id)}
    )
    item = response.get("Item")
    if not item:
        raise RecordNotFoundError(
            f"Document folder {folder_id} not found for user {user_id}"
        )
    return _item_to_folder(user_id, item)


def delete_document_folder_by_id(user_id: str, folder_id: str):
    """Delete a folder; its documents fall back to the library root."""
    table = get_conversation_table_client(user_id)
    # Unfile documents in this folder (set FolderId back to null).
    docs = find_documents_by_user_id(user_id)
    for doc in docs:
        if doc.folder_id == folder_id:
            doc.folder_id = None
            store_document(user_id, doc)
    try:
        table.delete_item(
            Key={
                "PK": user_id,
                "SK": compose_document_folder_id(user_id, folder_id),
            },
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        raise RecordNotFoundError(
            f"Document folder {folder_id} not found for user {user_id}"
        )
