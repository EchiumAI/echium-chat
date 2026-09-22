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
from typing import Optional, Protocol

import boto3
from app.repositories.common import default_workspace_id
from app.repositories.models.workspace_document import WorkspaceDocumentModel
from app.repositories.workspace_document import find_documents_by_user_id

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


def _load_text(text_s3_key: str) -> str:
    if not text_s3_key:
        return ""
    try:
        response = s3_client.get_object(Bucket=DOCUMENT_BUCKET, Key=text_s3_key)
        return response["Body"].read().decode("utf-8")
    except Exception:
        logger.warning(f"Failed to load doc text {text_s3_key}", exc_info=True)
        return ""


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
        workspace_id = default_workspace_id(user_id)
        docs = find_documents_by_user_id(user_id, workspace_id)

        visible = [
            d
            for d in docs
            if d.text_s3_key and _doc_visible(d, agent_id, exclude_conversation_id)
        ]
        # Documents first (agent's shared knowledge), then recent summaries.
        usable_docs = [d for d in visible if d.source != "chat_summary"]
        summaries = [d for d in visible if d.source == "chat_summary"]
        candidates = usable_docs + summaries

        results: list[RetrievedDoc] = []
        for doc in candidates[:limit]:
            text = _load_text(doc.text_s3_key)[:MAX_ITEM_CHARS].strip()
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

            workspace_id = default_workspace_id(user_id)
            doc_by_id = {
                d.id: d for d in find_documents_by_user_id(user_id, workspace_id)
            }
            visible_chunks = [
                chunk
                for chunk in find_document_chunks_by_user_id(user_id)
                if chunk.doc_id in doc_by_id
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


def build_workspace_context(
    user_id: str,
    agent_id: Optional[str],
    exclude_conversation_id: Optional[str] = None,
    query: Optional[str] = None,
) -> str:
    """Return a Markdown 'Workspace knowledge' block to inject, or ''.

    ``query`` (the user's current message) drives relevance ranking when the
    embedding retriever is enabled; the recency retriever ignores it.
    Best-effort — callers wrap this so retrieval never breaks the chat flow.
    """
    try:
        retriever = get_workspace_retriever()
        docs = retriever.retrieve(user_id, agent_id, exclude_conversation_id, query)
    except Exception:
        logger.warning("Workspace retrieval failed", exc_info=True)
        return ""

    if not docs:
        return ""

    sections: list[str] = []
    total = 0
    for doc in docs:
        block = f"## {doc.title}\n{doc.text}"
        if total + len(block) > MAX_TOTAL_CHARS:
            break
        sections.append(block)
        total += len(block)

    if not sections:
        return ""

    body = "\n\n".join(sections)
    return (
        "# Workspace knowledge\n"
        "The following comes from this workspace's documents and summaries of "
        "past conversations. You DO have access to prior conversations in this "
        "workspace through this context — use it naturally when relevant, and "
        "never tell the user you cannot see other chats or that conversations "
        "are siloed. Do not repeat it verbatim.\n\n"
        f"{body}"
    )
