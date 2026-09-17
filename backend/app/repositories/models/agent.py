"""Data model for lightweight agents.

An agent is a named system prompt (plus an optional model and tool toggles)
that a user chats with. Unlike the heavyweight "bot" feature, agents have NO
knowledge base, publishing, sharing, or sync pipeline — so they are cheap and
live on the conversation table like folders:

    PK = user_id
    SK = {user_id}#AGENT#{agent_id}
    ItemType = "AGENT"
    WorkspaceId = <the owning workspace>

Heavy capabilities (knowledge base / RAG, documents, team sharing, MCP
connections) belong to the *workspace* and are shared by all its agents — not
to the agent itself.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AgentModel(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str = ""
    # The system prompt that defines the agent's behavior.
    instruction: str = ""
    # Durable "memory" / steering notes the agent always carries (Markdown).
    # User-editable and (later) auto-updated after conversations. Injected into
    # the system prompt after the instruction.
    memory: str = ""
    # Model id the agent uses; None => use the user's currently selected model.
    model: Optional[str] = None
    # Enabled tool names, e.g. ["internet_search"]. Empty => no tools.
    tools: list[str] = Field(default_factory=list)
    create_time: float
    update_time: float
