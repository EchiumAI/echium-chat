"""Cheap RAG embeddings: Titan Text Embeddings v2 + in-Lambda cosine.

No standing infrastructure. Vectors are generated on write with Bedrock Titan
and stored as chunk items on the existing DynamoDB conversation table (see
``repositories.workspace_document``). Similarity is computed in-process at query
time. This backs ``EmbeddingWorkspaceRetriever`` (RAG "Phase B"); it is enabled
via the ``WORKSPACE_RETRIEVER`` env flag and is never required — retrieval falls
back to direct text injection when it is off or when a doc has no embeddings.
"""

import json
import logging
import math
import os

from app.utils import get_bedrock_runtime_client

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Titan Text Embeddings v2 (available in eu-west-1). 1024 dims, normalized.
EMBEDDING_MODEL_ID = os.environ.get(
    "EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"
)
EMBEDDING_DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "1024"))

# Character-based chunking (cheap, model-agnostic). ~2000 chars ≈ 500 tokens.
CHUNK_SIZE_CHARS = int(os.environ.get("EMBEDDING_CHUNK_CHARS", "2000"))
CHUNK_OVERLAP_CHARS = int(os.environ.get("EMBEDDING_CHUNK_OVERLAP_CHARS", "200"))


def embeddings_enabled() -> bool:
    """True when the embedding retriever is on (``WORKSPACE_RETRIEVER=embedding``)."""
    return os.environ.get("WORKSPACE_RETRIEVER", "").strip().lower() == "embedding"


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping character windows for embedding."""
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= CHUNK_SIZE_CHARS:
        return [text]
    step = max(CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS, 1)
    chunks: list[str] = []
    start = 0
    while start < len(text):
        piece = text[start : start + CHUNK_SIZE_CHARS].strip()
        if piece:
            chunks.append(piece)
        start += step
    return chunks


def _embed_one(text: str) -> list[float]:
    client = get_bedrock_runtime_client()
    response = client.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(
            {
                "inputText": text,
                "dimensions": EMBEDDING_DIMENSIONS,
                "normalize": True,
            }
        ),
    )
    payload = json.loads(response["body"].read())
    return list(payload["embedding"])


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts (Titan accepts one input per call)."""
    return [_embed_one(t) for t in texts]


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return _embed_one(text)


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity; 0.0 for empty/mismatched vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
