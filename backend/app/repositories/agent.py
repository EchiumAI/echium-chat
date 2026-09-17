"""Repository for lightweight agents.

Stored on the conversation table, mirroring the folder pattern:
    PK = user_id, SK = {user_id}#AGENT#{id}, ItemType = "AGENT",
    WorkspaceId = owning workspace.
No GSIs, no OpenSearch — deliberately cheap.
"""

import logging
from decimal import Decimal as decimal

from app.repositories.common import (
    RecordNotFoundError,
    compose_agent_id,
    decompose_agent_id,
    default_workspace_id,
    get_conversation_table_client,
)
from app.repositories.models.agent import AgentModel
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _item_to_agent(user_id: str, item: dict) -> AgentModel:
    return AgentModel(
        id=decompose_agent_id(item["SK"]),
        workspace_id=item.get("WorkspaceId") or default_workspace_id(user_id),
        name=item.get("AgentName", ""),
        description=item.get("Description", ""),
        instruction=item.get("Instruction", ""),
        memory=item.get("Memory", ""),
        model=item.get("ModelId"),
        tools=list(item.get("Tools", []) or []),
        create_time=float(item.get("CreateTime", 0)),
        update_time=float(item.get("UpdateTime", 0)),
    )


def store_agent(user_id: str, agent: AgentModel):
    """Create or overwrite an agent item."""
    logger.info(f"Storing agent {agent.id} for user {user_id}")
    table = get_conversation_table_client(user_id)
    table.put_item(
        Item={
            "PK": user_id,
            "SK": compose_agent_id(user_id, agent.id),
            "ItemType": "AGENT",
            "WorkspaceId": agent.workspace_id or default_workspace_id(user_id),
            "AgentName": agent.name,
            "Description": agent.description,
            "Instruction": agent.instruction,
            "Memory": agent.memory,
            "ModelId": agent.model,
            "Tools": agent.tools,
            "CreateTime": decimal(agent.create_time),
            "UpdateTime": decimal(agent.update_time),
        }
    )


def find_agents_by_user_id(
    user_id: str, workspace_id: str | None = None
) -> list[AgentModel]:
    """List a user's agents (newest first), optionally filtered to a workspace."""
    table = get_conversation_table_client(user_id)
    response = table.query(
        KeyConditionExpression=Key("PK").eq(user_id)
        & Key("SK").begins_with(f"{user_id}#AGENT#"),
        ScanIndexForward=False,
    )
    agents = [_item_to_agent(user_id, item) for item in response["Items"]]
    if workspace_id is not None:
        agents = [a for a in agents if a.workspace_id == workspace_id]
    return agents


def find_agent_by_id(user_id: str, agent_id: str) -> AgentModel:
    table = get_conversation_table_client(user_id)
    response = table.get_item(
        Key={"PK": user_id, "SK": compose_agent_id(user_id, agent_id)}
    )
    item = response.get("Item")
    if not item:
        raise RecordNotFoundError(f"Agent {agent_id} not found for user {user_id}")
    return _item_to_agent(user_id, item)


def delete_agent_by_id(user_id: str, agent_id: str):
    table = get_conversation_table_client(user_id)
    try:
        table.delete_item(
            Key={"PK": user_id, "SK": compose_agent_id(user_id, agent_id)},
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        raise RecordNotFoundError(f"Agent {agent_id} not found for user {user_id}")
