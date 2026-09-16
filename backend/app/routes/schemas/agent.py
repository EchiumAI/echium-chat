from typing import Literal, Optional

from app.routes.schemas.base import BaseSchema


class AgentInput(BaseSchema):
    name: str
    description: Optional[str] = None
    instruction: str
    model: Optional[str] = None
    tools: list[str] = []


class AgentModifyInput(BaseSchema):
    name: str
    description: Optional[str] = None
    instruction: str
    model: Optional[str] = None
    tools: list[str] = []


class AgentOutput(BaseSchema):
    id: str
    workspace_id: str
    name: str
    description: str
    instruction: str
    model: Optional[str]
    tools: list[str]
    create_time: float
    update_time: float


# --- Conversational agent-creator wizard ---------------------------------- #


class WizardMessage(BaseSchema):
    role: Literal["user", "assistant"]
    content: str


class AgentWizardInput(BaseSchema):
    # The conversation so far (the frontend shows a localized greeting first,
    # so the first entry here is the user's opening message).
    messages: list[WizardMessage]


class AgentWizardOutput(BaseSchema):
    # The interviewer's next message to show the user.
    reply: str
    # True once the agent has been created (the wizard can close).
    done: bool
    # The created agent, present only when done is True.
    agent: Optional[AgentOutput] = None
