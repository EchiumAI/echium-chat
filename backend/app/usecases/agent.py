"""Agent usecases — lightweight, workspace-scoped.

Agents are created/listed/deleted here. Creation is normally driven by the
conversational agent-creator wizard (which produces the name/instruction/model/
tools), but the same usecases back a plain create call too.
"""

from __future__ import annotations

from app.repositories.agent import (
    delete_agent_by_id,
    find_agent_by_id,
    find_agents_by_user_id,
    store_agent,
)
from app.repositories.common import default_workspace_id
from app.repositories.models.agent import AgentModel
from app.routes.schemas.agent import AgentInput, AgentModifyInput, AgentOutput
from app.utils import get_current_time
from ulid import ULID


def _to_output(agent: AgentModel) -> AgentOutput:
    return AgentOutput(
        id=agent.id,
        workspace_id=agent.workspace_id,
        name=agent.name,
        description=agent.description,
        instruction=agent.instruction,
        memory=agent.memory,
        model=agent.model,
        tools=agent.tools,
        create_time=agent.create_time,
        update_time=agent.update_time,
    )


def create_agent(user_id: str, agent_input: AgentInput) -> AgentOutput:
    now = float(get_current_time())
    agent = AgentModel(
        id=str(ULID()),
        workspace_id=default_workspace_id(user_id),
        name=agent_input.name,
        description=agent_input.description or "",
        instruction=agent_input.instruction,
        memory=agent_input.memory or "",
        model=agent_input.model,
        tools=agent_input.tools,
        create_time=now,
        update_time=now,
    )
    store_agent(user_id, agent)
    return _to_output(agent)


def list_agents(user_id: str) -> list[AgentOutput]:
    workspace_id = default_workspace_id(user_id)
    return [_to_output(a) for a in find_agents_by_user_id(user_id, workspace_id)]


def get_agent(user_id: str, agent_id: str) -> AgentOutput:
    return _to_output(find_agent_by_id(user_id, agent_id))


def modify_agent(
    user_id: str, agent_id: str, agent_input: AgentModifyInput
) -> AgentOutput:
    existing = find_agent_by_id(user_id, agent_id)
    updated = AgentModel(
        id=existing.id,
        workspace_id=existing.workspace_id,
        name=agent_input.name,
        description=agent_input.description or "",
        instruction=agent_input.instruction,
        # If the edit form omits memory, keep the existing memory rather than
        # wiping it (memory is also updated out-of-band by auto-memory).
        memory=(
            agent_input.memory if agent_input.memory is not None else existing.memory
        ),
        model=agent_input.model,
        tools=agent_input.tools,
        create_time=existing.create_time,
        update_time=float(get_current_time()),
    )
    store_agent(user_id, updated)
    return _to_output(updated)


def delete_agent(user_id: str, agent_id: str) -> None:
    delete_agent_by_id(user_id, agent_id)
