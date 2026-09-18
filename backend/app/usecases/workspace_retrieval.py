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


class SimpleWorkspaceRetriever:
    """Phase A retriever: visibility-filtered, recency-ordered, no embeddings."""

    def retrieve(
        self,
        user_id: str,
        agent_id: Optional[str],
        exclude_conversation_id: Optional[str],
        limit: int = MAX_ITEMS,
    ) -> list[RetrievedDoc]:
        workspace_id = default_workspace_id(user_id)
        docs = find_documents_by_user_id(user_id, workspace_id)

        # Workspace chat summaries are public within the workspace (exclude the
        # current conversation's own summary to avoid self-reference).
        summaries = [
            d
            for d in docs
            if d.source == "chat_summary"
            and d.source_conversation_id != exclude_conversation_id
            and d.text_s3_key
        ]

        # Regular documents are only injected for agents, and only those the
        # agent is allowed to use.
        usable_docs = []
        if agent_id:
            usable_docs = [
                d
                for d in docs
                if d.source != "chat_summary"
                and d.text_s3_key
                and (d.all_agents or agent_id in d.allowed_agent_ids)
            ]

        # Documents first (agent's shared knowledge), then recent summaries.
        candidates = usable_docs + summaries
        results: list[RetrievedDoc] = []
        for doc in candidates[:limit]:
            text = _load_text(doc.text_s3_key)[:MAX_ITEM_CHARS].strip()
            if text:
                results.append(
                    RetrievedDoc(title=doc.filename, text=text, source=doc.source)
                )
        return results


def get_workspace_retriever() -> WorkspaceRetriever:
    """Factory — swap to an embedding/OpenSearch retriever here later."""
    return SimpleWorkspaceRetriever()


def build_workspace_context(
    user_id: str,
    agent_id: Optional[str],
    exclude_conversation_id: Optional[str] = None,
) -> str:
    """Return a Markdown 'Workspace knowledge' block to inject, or ''.

    Best-effort — callers wrap this so retrieval never breaks the chat flow.
    """
    try:
        retriever = get_workspace_retriever()
        docs = retriever.retrieve(user_id, agent_id, exclude_conversation_id)
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
        "The following context comes from this workspace's documents and past "
        "conversations. Use it when relevant; do not repeat it verbatim.\n\n"
        f"{body}"
    )
