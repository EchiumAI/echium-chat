"""Conversational agent-creator wizard.

An interviewer (fixed system prompt) talks to the user in their own language and,
once it has enough detail, calls the `save_agent` tool to create a lightweight
agent via the normal agent usecases. Turn-by-turn over HTTP: the frontend sends
the conversation so far and gets back the interviewer's next message (and, once
created, the agent).
"""

from __future__ import annotations

import logging
import os

from app.routes.schemas.agent import (
    AgentInput,
    AgentWizardOutput,
    WizardMessage,
)
from app.strands_integration.agent.config import get_bedrock_model_config
from app.usecases.agent import create_agent
from app.usecases.global_config import get_default_model
from strands import Agent, tool
from strands.models import BedrockModel

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")

# Use the same default model the rest of the app uses (configured via the
# DEFAULT_MODEL env, falling back to claude-v3.7-sonnet). Hardcoding an older
# model broke in eu-west-1, where it lacks an on-demand/inference-profile path.

INTERVIEWER_PROMPT = """You are Echium's Agent Creator — a friendly assistant that helps a user design a new AI agent through a short, natural conversation.

ALWAYS reply in the same language the user is writing in.

How to work:
1. Understand what the user wants the agent to do (its role/purpose).
2. Ask brief, focused follow-up questions ONLY as needed to define: a short name, the agent's purpose and behavior, its tone/personality, and whether it should be able to search the internet. Ask one or two questions at a time — keep it light and conversational, never an interrogation.
3. When you have enough to define a genuinely useful agent, briefly confirm the plan in one sentence, then call the `save_agent` tool with:
   - name: a short, human-friendly name.
   - instruction: a clear, well-written system prompt (in the user's language) telling the agent who it is, what it does, its tone, and any rules. This is the most important field — make it actually good.
   - description: one short sentence describing the agent.
   - enable_web_search: true only if the agent clearly benefits from live internet search.
4. After the tool succeeds, tell the user their agent is ready.

Keep every message short. Do not ask about technical settings (models, tokens) — choose sensible defaults yourself."""


def _build_save_agent_tool(user_id: str, holder: dict):
    """A Strands tool that persists the agent and records it in `holder`."""

    @tool
    def save_agent(
        name: str,
        instruction: str,
        description: str = "",
        enable_web_search: bool = False,
    ) -> dict:
        """Create the new agent once enough detail has been gathered.

        Args:
            name: Short, human-friendly agent name.
            instruction: The agent's system prompt (in the user's language).
            description: One short sentence describing the agent.
            enable_web_search: Whether the agent may search the internet.
        """
        tools = ["internet_search"] if enable_web_search else []
        created = create_agent(
            user_id,
            AgentInput(
                name=name,
                instruction=instruction,
                description=description or None,
                model=None,
                tools=tools,
            ),
        )
        holder["agent"] = created
        return {
            "status": "success",
            "content": [{"text": f"Created agent '{name}'."}],
        }

    return save_agent


def _extract_reply_text(message) -> str:
    """Pull the assistant's text out of a Strands result message."""
    content = message.get("content", []) if isinstance(message, dict) else []
    parts = [
        block["text"]
        for block in content
        if isinstance(block, dict) and "text" in block
    ]
    return "\n".join(parts).strip()


def run_agent_wizard(user_id: str, messages: list[WizardMessage]) -> AgentWizardOutput:
    """Run one interviewer turn over the conversation so far."""
    if not messages:
        return AgentWizardOutput(
            reply="Tell me what kind of agent you'd like to create.",
            done=False,
            agent=None,
        )

    holder: dict = {}
    model_config = get_bedrock_model_config(
        model_name=get_default_model(),
        instructions=[INTERVIEWER_PROMPT],
        has_tools=True,
    )
    model = BedrockModel(region_name=BEDROCK_REGION, **model_config)
    agent = Agent(
        model=model,
        tools=[_build_save_agent_tool(user_id, holder)],
        system_prompt=INTERVIEWER_PROMPT,
    )

    strands_messages = [
        {"role": m.role, "content": [{"text": m.content}]} for m in messages
    ]

    try:
        result = agent(strands_messages)  # type: ignore[arg-type]
        reply = _extract_reply_text(result.message)
    except Exception as e:
        logger.exception("[AGENT_WIZARD] error")
        # Alpha: surface a short error detail so issues can be diagnosed
        # without CloudWatch access. Safe to remove once the wizard is stable.
        detail = f"{type(e).__name__}: {e}"[:300]
        return AgentWizardOutput(
            reply=(
                "Sorry, I couldn't continue creating the agent right now. "
                f"Please try again.\n\n(debug: {detail})"
            ),
            done=False,
            agent=None,
        )

    created = holder.get("agent")
    return AgentWizardOutput(
        reply=reply,
        done=created is not None,
        agent=created,
    )
