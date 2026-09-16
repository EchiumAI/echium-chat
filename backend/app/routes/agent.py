from app.routes.schemas.agent import (
    AgentInput,
    AgentModifyInput,
    AgentOutput,
    AgentWizardInput,
    AgentWizardOutput,
)
from app.usecases.agent import (
    create_agent,
    delete_agent,
    get_agent,
    list_agents,
    modify_agent,
)
from app.usecases.agent_wizard import run_agent_wizard
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["agent"])


@router.post("/agents/wizard", response_model=AgentWizardOutput)
def post_agent_wizard(request: Request, wizard_input: AgentWizardInput):
    """Run one turn of the conversational agent-creator wizard.

    The interviewer replies in the user's language and, once it has enough
    detail, creates the agent and returns it with done=True.
    """
    current_user: User = request.state.current_user
    return run_agent_wizard(current_user.id, wizard_input.messages)


@router.post("/agents", response_model=AgentOutput)
def post_agent(request: Request, agent_input: AgentInput):
    """Create a lightweight agent in the user's (default) workspace."""
    current_user: User = request.state.current_user
    return create_agent(current_user.id, agent_input)


@router.get("/agents", response_model=list[AgentOutput])
def get_agents(request: Request):
    """List the user's agents in their (default) workspace."""
    current_user: User = request.state.current_user
    return list_agents(current_user.id)


@router.get("/agents/{agent_id}", response_model=AgentOutput)
def get_single_agent(request: Request, agent_id: str):
    current_user: User = request.state.current_user
    return get_agent(current_user.id, agent_id)


@router.patch("/agents/{agent_id}", response_model=AgentOutput)
def patch_agent(request: Request, agent_id: str, agent_input: AgentModifyInput):
    current_user: User = request.state.current_user
    return modify_agent(current_user.id, agent_id, agent_input)


@router.delete("/agents/{agent_id}")
def delete_single_agent(request: Request, agent_id: str):
    current_user: User = request.state.current_user
    delete_agent(current_user.id, agent_id)
    return {"status": "ok"}
