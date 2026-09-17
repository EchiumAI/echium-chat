"""Auto-memory for agents.

After a conversation with an agent, distill durable facts/preferences from the
exchange and merge them into the agent's `memory` (incremental, deduped). This
runs off the chat hot path — the frontend calls it fire-and-forget once a turn
finishes — and reuses the same cheap one-shot Converse pattern as title
generation.
"""

from __future__ import annotations

import logging

from app.bedrock import call_converse_api, compose_args_for_converse_api
from app.repositories.agent import find_agent_by_id, store_agent
from app.repositories.conversation import find_conversation_by_id
from app.repositories.models.conversation import (
    ReasoningContentModel,
    SimpleMessageModel,
    TextContentModel,
    ToolResultContentModel,
    ToolUseContentModel,
)
from app.usecases.chat import trace_to_root
from app.usecases.global_config import get_title_model
from app.utils import get_current_time

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

REFLECT_PROMPT = """Based on the conversation above, update the assistant agent's long-term memory.

The agent's current memory (Markdown) is:
---
{existing_memory}
---

Extract only DURABLE, reusable facts, preferences, and context about the user or the task that would help the agent in FUTURE conversations. Merge them with the current memory: keep what is still relevant, add new durable facts, and remove duplicates. Ignore one-off chit-chat and ephemeral details. Keep it concise, organized, and in Markdown. Write in the same language as the conversation.

Return ONLY the updated memory content as Markdown, with no preamble, no code fences, and no explanation. If there is nothing worth remembering, return the current memory unchanged."""


def reflect_agent_memory(user_id: str, agent_id: str, conversation_id: str) -> str:
    """Update an agent's memory from a conversation. Returns the new memory."""
    agent = find_agent_by_id(user_id, agent_id)
    conversation = find_conversation_by_id(user_id, conversation_id)

    messages = trace_to_root(
        node_id=conversation.last_message_id,
        message_map=conversation.message_map,
    )
    if not messages:
        return agent.memory

    prompt = REFLECT_PROMPT.format(existing_memory=agent.memory or "(empty)")
    messages.append(
        SimpleMessageModel(
            role="user",
            content=[TextContentModel(content_type="text", body=prompt)],
        )
    )

    # Exclude tool/reasoning turns (mirrors title generation).
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
        updated = (
            response["output"]["message"]["content"][0]["text"]
            if "message" in response["output"]
            and len(response["output"]["message"]["content"]) > 0
            and "text" in response["output"]["message"]["content"][0]
            else ""
        ).strip()
    except Exception:
        logger.exception("[AGENT_MEMORY] reflection failed")
        return agent.memory

    # Only persist a meaningful, changed result.
    if updated and updated != agent.memory:
        agent.memory = updated
        agent.update_time = float(get_current_time())
        store_agent(user_id, agent)

    return agent.memory
