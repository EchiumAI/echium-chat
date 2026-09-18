"""Workspace conversational memory (M5).

Every conversation (agent or general) gets a concise rolling summary. It's
stored on the conversation and mirrored as a system document so the whole
workspace can later draw on what past chats discussed. Runs off the chat hot
path — the frontend calls it fire-and-forget after a turn — and reuses the
cheap one-shot Converse pattern (title model).
"""

from __future__ import annotations

import logging

from app.bedrock import call_converse_api, compose_args_for_converse_api
from app.repositories.conversation import (
    find_conversation_by_id,
    update_conversation_summary,
)
from app.repositories.models.conversation import (
    ReasoningContentModel,
    SimpleMessageModel,
    TextContentModel,
    ToolResultContentModel,
    ToolUseContentModel,
)
from app.usecases.chat import trace_to_root
from app.usecases.global_config import get_title_model
from app.usecases.workspace_document import upsert_chat_summary_document
from app.utils import get_current_time

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SUMMARY_PROMPT = """Based on the conversation above, produce an updated running summary of this conversation for a shared workspace memory.

The current summary (Markdown) is:
---
{existing}
---

Capture the durable, reusable substance: the topics discussed, key facts and data, decisions made, and any open threads. Merge with the current summary, keeping it concise, factual, and in Markdown. Ignore pleasantries. Write in the same language as the conversation.

Return ONLY the updated summary as Markdown, with no preamble, code fences, or explanation."""


def summarize_conversation(user_id: str, conversation_id: str) -> str:
    """(Re)generate a conversation's rolling summary. Returns the summary."""
    conversation = find_conversation_by_id(user_id, conversation_id)

    messages = trace_to_root(
        node_id=conversation.last_message_id,
        message_map=conversation.message_map,
    )
    if not messages:
        return conversation.summary

    prompt = SUMMARY_PROMPT.format(existing=conversation.summary or "(empty)")
    messages.append(
        SimpleMessageModel(
            role="user",
            content=[TextContentModel(content_type="text", body=prompt)],
        )
    )

    args = compose_args_for_converse_api(
        messages=[
            message
            for message in messages
            if not any(
                isinstance(content, ToolUseContentModel)
                or isinstance(content, ToolResultContentModel)
                or isinstance(content, ReasoningContentModel)
                for content in message.content
            )
        ],
        model=get_title_model(),
        stream=False,
    )

    try:
        response = call_converse_api(args)
        summary = (
            response["output"]["message"]["content"][0]["text"]
            if "message" in response["output"]
            and len(response["output"]["message"]["content"]) > 0
            and "text" in response["output"]["message"]["content"][0]
            else ""
        ).strip()
    except Exception:
        logger.exception("[CONVERSATION_MEMORY] summarization failed")
        return conversation.summary

    if not summary:
        return conversation.summary

    now = float(get_current_time())
    update_conversation_summary(user_id, conversation_id, summary, now)
    try:
        upsert_chat_summary_document(
            user_id, conversation_id, summary, conversation.title
        )
    except Exception:
        logger.warning(
            "[CONVERSATION_MEMORY] failed to store summary document", exc_info=True
        )
    return summary
