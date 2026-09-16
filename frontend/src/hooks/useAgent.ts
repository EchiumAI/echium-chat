import { produce } from 'immer';
import { AgentInput, AgentModifyInput } from '../@types/agent';
import useAgentApi from './useAgentApi';

const useAgent = () => {
  const api = useAgentApi();

  const {
    data: agents,
    mutate: mutateAgents,
    isLoading: isLoadingAgents,
  } = api.agents();

  return {
    agents,
    mutateAgents,
    isLoadingAgents,
    getAgent: async (agentId: string) => {
      return (await api.getOnceAgent(agentId)).data;
    },
    registerAgent: (params: AgentInput) => {
      return api.registerAgent(params).finally(() => {
        mutateAgents();
      });
    },
    updateAgent: (agentId: string, params: AgentModifyInput) => {
      mutateAgents(
        produce(agents, (draft) => {
          const idx = agents?.findIndex((a) => a.id === agentId) ?? -1;
          if (draft && idx > -1) {
            draft[idx].name = params.name;
            draft[idx].description = params.description ?? '';
            draft[idx].instruction = params.instruction;
            draft[idx].model = params.model ?? null;
            draft[idx].tools = params.tools ?? [];
          }
        }),
        { revalidate: false }
      );
      return api.updateAgent(agentId, params).finally(() => {
        mutateAgents();
      });
    },
    deleteAgent: (agentId: string) => {
      // Optimistic update: drop the agent before the server confirms.
      const idx = agents?.findIndex((a) => a.id === agentId) ?? -1;
      mutateAgents(
        produce(agents, (draft) => {
          if (draft && idx > -1) {
            draft.splice(idx, 1);
          }
        }),
        { revalidate: false }
      );
      return api
        .deleteAgent(agentId)
        .then(() => {
          mutateAgents();
        })
        .catch((error) => {
          console.error('Failed to delete agent:', error);
          mutateAgents();
          throw error;
        });
    },
  };
};

export default useAgent;
