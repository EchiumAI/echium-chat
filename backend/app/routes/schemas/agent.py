from typing import Literal, Optional

from app.routes.schemas.base import BaseSchema


class AgentInput(BaseSchema):
    name: str
    description: Optional[str] = None
    instruction: str
    memory: Optional[str] = None
    model: Optional[str] = None
    tools: list[str] = []


class AgentModifyInput(BaseSchema):
    name: str
    description: Optional[str] = None
    instruction: str
    memory: Optional[str] = None
    model: Optional[str] = None
    tools: list[str] = []


class AgentReflectInput(BaseSchema):
    # The conversation whose content should be distilled into the agent memory.
    conversation_id: str


class AgentReflectOutput(BaseSchema):
    # The agent's memory after reflection.
    memory: str


class AgentOutput(BaseSchema):
    id: str
    workspace_id: str
    name: str
    description: str
    instruction: str
    memory: str
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
