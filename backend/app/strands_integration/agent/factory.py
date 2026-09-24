"""
Agent factory for Strands integration.
"""

import logging
import os

from app.repositories.models.conversation import type_model_name
from app.repositories.models.custom_bot import BotModel, GenerationParamsModel
from app.repositories.models.custom_bot_guardrails import BedrockGuardrailsModel
from app.strands_integration.utils import get_strands_tools
from strands import Agent
from strands.hooks import HookProvider
from strands.models import BedrockModel

from app.strands_integration.agent.config import get_bedrock_model_config

logger = logging.getLogger(__name__)

BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")

# Base persona prepended to every agent's system prompt so the assistant is
# grounded as Echium rather than falling back to the underlying model's own
# identity. Custom bot instructions layer on top of this.
ECHIUM_PERSONA = (
    "You are Echium, the AI assistant for the Echium workspace. "
    "Always identify yourself as Echium. Never state or imply that you are "
    "Claude, Anthropic, or any other underlying model or provider. If asked "
    "which model or company is behind you, say you are Echium's assistant "
    "without disclosing the underlying provider."
)


def create_strands_agent(
    bot: BotModel | None,
    instructions: list[str],
    model_name: type_model_name,
    generation_params: GenerationParamsModel | None = None,
    guardrail: BedrockGuardrailsModel | None = None,
    enable_reasoning: bool = False,
    prompt_caching_enabled: bool = False,
    has_tools: bool = False,
    include_web_search: bool = False,
    hooks: list[HookProvider] | None = None,
    extra_tools: list | None = None,
) -> Agent:
    model_config = get_bedrock_model_config(
        model_name=model_name,
        instructions=instructions,
        generation_params=generation_params,
        guardrail=guardrail,
        enable_reasoning=enable_reasoning,
        prompt_caching_enabled=prompt_caching_enabled,
        has_tools=has_tools,
    )
    logger.debug(f"[AGENT_FACTORY] Model config: {model_config}")
    model = BedrockModel(
        region_name=BEDROCK_REGION,
        **model_config,
    )

    # Strands does not support a list of instructions, so we join them into a
    # single string. The Echium persona is always first so the assistant keeps
    # its identity even when the agent has no instructions of its own.
    system_prompt = "\n\n".join([ECHIUM_PERSONA, *instructions]).strip()

    tools = get_strands_tools(bot, model_name, include_web_search=include_web_search)
    if extra_tools:
        tools = [*tools, *extra_tools]

    agent = Agent(
        model=model,
        tools=tools,  # type: ignore
        hooks=hooks or [],
        system_prompt=system_prompt,
    )
    return agent
