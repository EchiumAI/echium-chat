import {
  AgentInput,
  AgentModifyInput,
  AgentWizardRequest,
  AgentWizardResponse,
  GetAgentResponse,
  GetAgentsResponse,
  RegisterAgentResponse,
  UpdateAgentResponse,
} from '../@types/agent';
import useHttp from './useHttp';

const useAgentApi = () => {
  const http = useHttp();

  return {
    agents: () => {
      return http.get<GetAgentsResponse>('agents');
    },
    getOnceAgent: (agentId: string) => {
      return http.getOnce<GetAgentResponse>(`agents/${agentId}`);
    },
    getAgent: (agentId?: string) => {
      return http.get<GetAgentResponse>(agentId ? `agents/${agentId}` : null);
    },
    registerAgent: (params: AgentInput) => {
      return http.post<RegisterAgentResponse>('agents', params);
    },
    updateAgent: (agentId: string, params: AgentModifyInput) => {
      return http.patch<UpdateAgentResponse>(`agents/${agentId}`, params);
    },
    deleteAgent: (agentId: string) => {
      return http.delete(`agents/${agentId}`);
    },
    // One turn of the conversational agent-creator wizard. The interviewer
    // replies in the user's language and, once it has enough detail, creates
    // the agent and returns it with done=true.
    wizard: (params: AgentWizardRequest) => {
      return http.post<AgentWizardResponse, AgentWizardRequest>(
        'agents/wizard',
        params
      );
    },
    // Auto-memory: distill durable facts from a finished conversation into the
    // agent's memory. Called fire-and-forget after an agent turn completes.
    reflectMemory: (agentId: string, conversationId: string) => {
      return http.post<{ memory: string }, { conversationId: string }>(
        `agents/${agentId}/reflect`,
        { conversationId }
      );
    },
  };
};

export default useAgentApi;
