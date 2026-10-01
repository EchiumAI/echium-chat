import { create } from 'zustand';
import { WorkspaceOverview } from '../@types/team';
import useHttp from './useHttp';

const STORAGE_KEY = 'echium.selectedWorkspace';

/**
 * The workspace the user is currently working in: "default" (personal) or a
 * team id. Persisted per browser so Files reopens where you left it. The
 * value is what the API expects in `/workspaces/{workspace}/...`.
 */
const useWorkspaceStore = create<{
  selected: string;
  setSelected: (workspace: string) => void;
}>((set) => ({
  selected: localStorage.getItem(STORAGE_KEY) || 'default',
  setSelected: (workspace) => {
    localStorage.setItem(STORAGE_KEY, workspace);
    set({ selected: workspace });
  },
}));

/** Path segment for a workspace overview (team id, or "default"). */
export const workspaceParamOf = (ws: WorkspaceOverview): string =>
  ws.kind === 'team' && ws.teamId ? ws.teamId : 'default';

const useWorkspace = () => {
  const http = useHttp();
  const { selected, setSelected } = useWorkspaceStore();
  const { data: workspaces, mutate } = http.get<WorkspaceOverview[]>(
    'workspaces',
    { keepPreviousData: true }
  );

  // If the remembered team no longer exists (left / deleted), fall back.
  const current =
    (workspaces ?? []).find((w) => workspaceParamOf(w) === selected) ??
    (workspaces ?? []).find((w) => w.isDefault);
  const selectedParam = current ? workspaceParamOf(current) : 'default';

  return {
    workspaces: workspaces ?? [],
    current,
    /** Use this in API paths: `workspaces/${selectedWorkspace}/documents`. */
    selectedWorkspace: selectedParam,
    selectWorkspace: setSelected,
    refreshWorkspaces: mutate,
  };
};

export default useWorkspace;
