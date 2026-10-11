"""Workspace knowledge retrieval (M4, Phase A).

Behind a small `WorkspaceRetriever` seam so the store can be swapped later
(Titan embeddings in DynamoDB, or a shared OpenSearch collection) without
touching callers — see docs/plans/agents-memory-and-workspace-docs.md §8.

Phase A is cheap and needs no vector store: it returns the text of the
documents an agent may use plus the workspace's chat summaries (recency-capped,
size-capped), for direct injection into the system prompt. Retrieval always
filters by agent visibility first.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Protocol

import boto3
from app.repositories.models.workspace_document import WorkspaceDocumentModel
from app.repositories.workspace_document import find_documents_by_user_id
from app.usecases.workspace_scope import all_scopes_for_user

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

DOCUMENT_BUCKET = os.environ.get("DOCUMENT_BUCKET", "documents")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
s3_client = boto3.client("s3", BEDROCK_REGION)

# Conservative caps so injection never blows the context or cost.
MAX_ITEMS = 8
MAX_TOTAL_CHARS = 6000
MAX_ITEM_CHARS = 2000


@dataclass
class RetrievedDoc:
    title: str
    text: str
    source: str


class WorkspaceRetriever(Protocol):
    def retrieve(
        self,
        user_id: str,
        agent_id: Optional[str],
        exclude_conversation_id: Optional[str],
        query: Optional[str] = None,
        limit: int = MAX_ITEMS,
    ) -> list[RetrievedDoc]: ...


def _load_text(text_s3_key: str, content_type: str = "") -> str:
    """Load a document body as readable text for prompt injection.

    Bodies saved by the Docs editor are HTML; strip them to text so the model
    sees content, not tags (which also wasted the per-item character budget).
    """
    if not text_s3_key:
        return ""
    try:
        response = s3_client.get_object(Bucket=DOCUMENT_BUCKET, Key=text_s3_key)
        raw = response["Body"].read().decode("utf-8")
    except Exception:
        logger.warning(f"Failed to load doc text {text_s3_key}", exc_info=True)
        return ""
    from app.usecases.document_text import body_to_plain_text

    return body_to_plain_text(raw, content_type)


def _doc_visible(
    doc: WorkspaceDocumentModel,
    agent_id: Optional[str],
    exclude_conversation_id: Optional[str],
) -> bool:
    """Whether a document (or its chunks) may be injected for this request.

    Chat summaries: visible to the agent that produced them, to all agents when
    shared, or to plain chat when scoped to no agent — but never the current
    conversation's own summary. Regular documents: only in an agent chat, and
    only when shared with that agent. This is the single source of truth for
    both the recency and embedding retrievers.
    """
    if doc.source == "chat_summary":
        if doc.source_conversation_id == exclude_conversation_id:
            return False
        return (
            doc.all_agents
            or (agent_id is not None and agent_id in doc.allowed_agent_ids)
            or (agent_id is None and not doc.allowed_agent_ids)
        )
    if agent_id is None:
        return False
    return doc.all_agents or agent_id in doc.allowed_agent_ids


def _all_visible_documents(user_id: str) -> list[WorkspaceDocumentModel]:
    """Documents from the user's personal workspace and every team they belong
    to, newest first. Team lookups are best-effort so a single bad team never
    breaks chat."""
    docs: list[WorkspaceDocumentModel] = []
    for scope in all_scopes_for_user(user_id):
        try:
            docs.extend(find_documents_by_user_id(scope.owner_key, scope.workspace_id))
        except Exception:
            logger.warning(
                f"Document lookup failed for {scope.workspace_id}", exc_info=True
            )
    docs.sort(key=lambda d: d.update_time, reverse=True)
    return docs


def visible_documents_with_owner(
    user_id: str,
    agent_id: Optional[str],
    exclude_conversation_id: Optional[str] = None,
) -> list[tuple[str, WorkspaceDocumentModel]]:
    """(storage owner key, document) for every document this agent may use,
    newest first. Includes files that only have raw bytes so their text can be
    extracted on demand."""
    pairs: list[tuple[str, WorkspaceDocumentModel]] = []
    for scope in all_scopes_for_user(user_id):
        try:
            for d in find_documents_by_user_id(scope.owner_key, scope.workspace_id):
                if (d.text_s3_key or d.s3_key) and _doc_visible(
                    d, agent_id, exclude_conversation_id
                ):
                    pairs.append((scope.owner_key, d))
        except Exception:
            logger.warning(
                f"Document lookup failed for {scope.workspace_id}", exc_info=True
            )
    pairs.sort(key=lambda p: p[1].update_time, reverse=True)
    return pairs


class SimpleWorkspaceRetriever:
    """Phase A retriever: visibility-filtered, recency-ordered, no embeddings."""

    def retrieve(
        self,
        user_id: str,
        agent_id: Optional[str],
        exclude_conversation_id: Optional[str],
        query: Optional[str] = None,  # unused: recency, not relevance
        limit: int = MAX_ITEMS,
    ) -> list[RetrievedDoc]:
        from app.usecases.workspace_document import ensure_document_text

        pairs = visible_documents_with_owner(user_id, agent_id, exclude_conversation_id)
        # Shared documents only. Chat summaries are no longer injected: picked
        # by recency, they pulled unrelated chats into every new conversation
        # and the model mixed them up. Personal context now comes from the
        # user's Profile & memory (usecases/user_profile.py).
        candidates = [p for p in pairs if p[1].source != "chat_summary"]

        results: list[RetrievedDoc] = []
        for owner_key, doc in candidates[:limit]:
            # Extracts text on first use for files uploaded before extraction
            # existed (they had raw bytes only, so agents never saw them).
            text = ensure_document_text(owner_key, doc)[:MAX_ITEM_CHARS].strip()
            if text:
                results.append(
                    RetrievedDoc(title=doc.filename, text=text, source=doc.source)
                )
        return results


class EmbeddingWorkspaceRetriever:
    """Phase B retriever: rank workspace chunks by embedding similarity.

    Uses the query to score pre-computed chunk embeddings (Titan v2) with an
    in-process cosine, so no vector database is needed. Visibility is evaluated
    against each chunk's *current* document (not the copy stored on the chunk),
    so a later share change is respected without re-embedding. Falls back to the
    recency retriever when there is no query or no chunks, and fills any
    remaining slots with recency docs so un-embedded (pre-existing) documents
    are still surfaced — there is no backfill.
    """

    def retrieve(
        self,
        user_id: str,
        agent_id: Optional[str],
        exclude_conversation_id: Optional[str],
        query: Optional[str] = None,
        limit: int = MAX_ITEMS,
    ) -> list[RetrievedDoc]:
        simple = SimpleWorkspaceRetriever()
        if not query or not query.strip():
            return simple.retrieve(
                user_id, agent_id, exclude_conversation_id, None, limit
            )

        try:
            from app.repositories.workspace_document import (
                find_document_chunks_by_user_id,
            )
            from app.usecases.embeddings import cosine, embed_query

            doc_by_id = {d.id: d for d in _all_visible_documents(user_id)}
            # Chunks live in each workspace's own partition (user or team).
            all_chunks = []
            for scope in all_scopes_for_user(user_id):
                try:
                    all_chunks.extend(find_document_chunks_by_user_id(scope.owner_key))
                except Exception:
                    logger.warning(
                        f"Chunk lookup failed for {scope.workspace_id}", exc_info=True
                    )
            visible_chunks = [
                chunk
                for chunk in all_chunks
                if chunk.doc_id in doc_by_id
                and doc_by_id[chunk.doc_id].source != "chat_summary"
                and _doc_visible(
                    doc_by_id[chunk.doc_id], agent_id, exclude_conversation_id
                )
            ]
            if not visible_chunks:
                return simple.retrieve(
                    user_id, agent_id, exclude_conversation_id, None, limit
                )

            query_vector = embed_query(query)
            ranked = sorted(
                visible_chunks,
                key=lambda c: cosine(query_vector, c.vector),
                reverse=True,
            )
            results: list[RetrievedDoc] = [
                RetrievedDoc(
                    title=chunk.filename,
                    text=chunk.text[:MAX_ITEM_CHARS].strip(),
                    source=chunk.source,
                )
                for chunk in ranked[:limit]
                if chunk.text.strip()
            ]
        except Exception:
            logger.warning(
                "Embedding retrieval failed; falling back to recency", exc_info=True
            )
            return simple.retrieve(
                user_id, agent_id, exclude_conversation_id, None, limit
            )

        # Hybrid: fill remaining slots with recency docs not already represented
        # (covers documents created before embeddings were enabled).
        if len(results) < limit:
            seen = {r.title for r in results}
            for doc in simple.retrieve(
                user_id, agent_id, exclude_conversation_id, None, limit
            ):
                if doc.title not in seen:
                    results.append(doc)
                    seen.add(doc.title)
                    if len(results) >= limit:
                        break
        return results


def get_workspace_retriever() -> WorkspaceRetriever:
    """Factory — embedding retriever when enabled, else recency injection."""
    from app.usecases.embeddings import embeddings_enabled

    if embeddings_enabled():
        return EmbeddingWorkspaceRetriever()
    return SimpleWorkspaceRetriever()


# How many files the per-turn file index lists (newest first).
MAX_INDEX_FILES = 60


def _file_origin(doc: WorkspaceDocumentModel, conversation_id: Optional[str]) -> str:
    if doc.source_conversation_id and doc.source_conversation_id == conversation_id:
        return "from this conversation"
    if doc.source == "agent":
        return "saved by you in another conversation"
    if doc.source == "chat":
        return "attached in another conversation"
    return "added by the user"


def format_file_index(
    docs: list[WorkspaceDocumentModel], conversation_id: Optional[str]
) -> str:
    """A short list of files the agent may read, without their contents."""
    if not docs:
        return ""
    lines = []
    for doc in docs[:MAX_INDEX_FILES]:
        when = datetime.fromtimestamp(doc.update_time, tz=timezone.utc).strftime(
            "%Y-%m-%d"
        )
        lines.append(f"- {doc.filename} ({_file_origin(doc, conversation_id)}, {when})")
    more = len(docs) - MAX_INDEX_FILES
    if more > 0:
        lines.append(f"- … and {more} more (call list_shared_files to see all)")
    return (
        "## Files you can read\n"
        "Reference material only. Their contents are NOT part of this "
        "conversation and do not tell you what the user wants now. When a "
        "request needs one of them, read it with read_shared_file; otherwise "
        "ignore them.\n" + "\n".join(lines)
    )


def build_agent_context(
    user_id: str,
    agent_id: str,
    conversation_id: Optional[str],
    include_memory: bool = True,
) -> str:
    """Per-turn background for an agent chat: its memory and file index.

    Built fresh on every turn and labelled as background, so the current
    conversation stays the topic: earlier versions pasted file excerpts and
    other chats' summaries in, and the model took them for the subject of the
    chat. Best-effort: returns '' on any failure.
    """
    parts: list[str] = []
    if include_memory:
        try:
            from app.repositories.agent import find_agent_by_id

            memory = find_agent_by_id(user_id, agent_id).memory.strip()
        except Exception:
            logger.warning("Agent memory lookup failed", exc_info=True)
            memory = ""
        if memory:
            parts.append(
                "## How the user wants you to work\n"
                "Standing notes from your past work with this user. They apply "
                "to every conversation, but they are not the topic of this "
                "one.\n" + memory
            )
    try:
        docs = [
            d
            for _, d in visible_documents_with_owner(user_id, agent_id)
            if d.source != "chat_summary"
        ]
    except Exception:
        logger.warning("File index lookup failed", exc_info=True)
        docs = []
    index = format_file_index(docs, conversation_id)
    if index:
        parts.append(index)
    if not parts:
        return ""
    return "# Background (not the topic of this conversation)\n\n" + "\n\n".join(parts)
