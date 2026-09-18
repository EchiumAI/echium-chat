"""Strands tool: let an agent save a document into the workspace.

The tool closes over the user + agent so the created document is stored in the
workspace document store and auto-shared with the agent that created it.
"""

import logging

from app.usecases.workspace_document import create_text_document
from strands import tool

logger = logging.getLogger(__name__)


def create_save_document_tool(user_id: str, agent_id: str | None):
    """Build a `save_document` tool bound to this user/agent."""

    @tool
    def save_document(title: str, content: str) -> dict:
        """Save a document to the workspace so it is stored and reusable.

        Use this when the user asks you to create, write, or save a document,
        note, report, or file. The document is added to the workspace and made
        available to you in future conversations.

        Args:
            title: A short, human-friendly title for the document.
            content: The full document content (Markdown is supported).
        """
        try:
            doc = create_text_document(
                user_id=user_id,
                title=title,
                content=content,
                agent_id=agent_id,
            )
            return {
                "status": "success",
                "content": [
                    {"text": f"Saved document '{doc.filename}' to the workspace."}
                ],
            }
        except Exception as e:
            logger.exception("[SAVE_DOCUMENT] failed")
            return {
                "status": "error",
                "content": [{"text": f"Failed to save the document: {e}"}],
            }

    return save_document
