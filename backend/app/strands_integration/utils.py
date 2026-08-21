"""
Strands integration utilities - Independent tool management.
"""

import logging
from typing import Dict

from app.bedrock import is_tooluse_supported
from app.repositories.models.custom_bot import BedrockAgentToolModel, BotModel
from app.routes.schemas.conversation import type_model_name
from strands.types.tools import AgentTool as StrandsAgentTool

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def get_strands_registered_tools(bot: BotModel | None = None) -> list[StrandsAgentTool]:
    """Get list of available Strands tools."""
    from app.strands_integration.tools.bedrock_agent import create_bedrock_agent_tool
    from app.strands_integration.tools.calculator import create_calculator_tool
    from app.strands_integration.tools.internet_search import (
        create_internet_search_tool,
    )
    from app.strands_integration.tools.simple_list import simple_list, structured_list

    tools: list[StrandsAgentTool] = []
    tools.append(create_internet_search_tool(bot))
    tools.append(create_bedrock_agent_tool(bot))
    # tools.append(create_calculator_tool(bot))  # For testing purposes
    return tools


def get_strands_tools(
    bot: BotModel | None,
    model_name: type_model_name,
    include_web_search: bool = False,
) -> list[StrandsAgentTool]:
    """
    Get Strands tools based on bot configuration.

    Similar to agents/utils.py get_tools() but optimized for Strands.

    `include_web_search` makes the internet-search tool available even without
    a bot (or when the bot has no agent), so Pro+ users can search the web in a
    normal chat. Entitlement is checked by the caller.
    """
    if not is_tooluse_supported(model_name):
        logger.warning(
            f"Tool use is not supported for model {model_name}. Returning empty tool list."
        )
        return []

    tools: list[StrandsAgentTool] = []

    # Bot-configured tools (only when the bot has agent mode enabled).
    if bot and bot.is_agent_enabled():
        registered_tools = get_strands_registered_tools(bot)

        for tool in bot.agent.tools:
            matched_tool = next(
                (t for t in registered_tools if t.tool_name == tool.name), None
            )
            if matched_tool:
                tools.append(matched_tool)

        # Add knowledge tool if bot has knowledge base
        if bot.has_knowledge():
            from app.strands_integration.tools.knowledge_search import (
                create_knowledge_search_tool,
            )

            tools.append(create_knowledge_search_tool(bot))

    # Internet search for entitled users, independent of any bot config.
    if include_web_search and not any(
        getattr(t, "tool_name", None) == "internet_search" for t in tools
    ):
        from app.strands_integration.tools.internet_search import (
            create_internet_search_tool,
        )

        tools.append(create_internet_search_tool(bot))

    if len(tools) == 0:
        return []

    logger.info(f"Strands tools configured: {[t.tool_name for t in tools]}")
    return tools
