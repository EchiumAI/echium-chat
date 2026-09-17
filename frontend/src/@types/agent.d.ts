// Lightweight workspace-scoped agents (name + instruction + model + tools).
// These are NOT the heavy "bot" entities: no per-agent knowledge base,
// publishing, sharing or aliases. See docs/workstreams.md for the roadmap.

export type Agent = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  instruction: string;
  // Durable memory / steering notes (Markdown), injected into the system
  // prompt and auto-updated after conversations.
  memory: string;
  model: string | null;
  tools: string[];
  createTime: number;
  updateTime: number;
};

export type AgentInput = {
  name: string;
  description?: string;
  instruction: string;
  memory?: string;
  model?: string;
  tools?: string[];
};

export type AgentModifyInput = AgentInput;

export type GetAgentsResponse = Agent[];
export type GetAgentResponse = Agent;
export type RegisterAgentResponse = Agent;
export type UpdateAgentResponse = Agent;

// --- Conversational agent-creator wizard --------------------------------- //

export type WizardMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentWizardRequest = {
  messages: WizardMessage[];
};

export type AgentWizardResponse = {
  // The interviewer's next message to show the user.
  reply: string;
  // True once the agent has been created (the wizard can close).
  done: boolean;
  // The created agent, present only when done is true.
  agent?: Agent;
};
