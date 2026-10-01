import { Team, TeamDetail, TeamRole } from '../@types/team';
import useHttp from './useHttp';

const useTeamApi = () => {
  const http = useHttp();

  return {
    teams: () => http.get<Team[]>('teams', { keepPreviousData: true }),
    team: (teamId: string | null) =>
      http.get<TeamDetail>(teamId ? `teams/${teamId}` : null, {
        keepPreviousData: true,
      }),
    createTeam: (name: string) => http.post<Team>('teams', { name }),
    renameTeam: (teamId: string, name: string) =>
      http.patch<Team>(`teams/${teamId}`, { name }),
    deleteTeam: (teamId: string) => http.delete(`teams/${teamId}`),
    invite: (teamId: string, email: string, role: 'admin' | 'member') =>
      http.post<TeamDetail>(`teams/${teamId}/members`, { email, role }),
    setRole: (teamId: string, userId: string, role: 'admin' | 'member') =>
      http.patch<TeamDetail>(`teams/${teamId}/members/${userId}`, { role }),
    removeMember: (teamId: string, userId: string) =>
      http.delete<TeamDetail>(`teams/${teamId}/members/${userId}`),
    revokeInvite: (teamId: string, email: string) =>
      http.delete<TeamDetail>(
        `teams/${teamId}/invites/${encodeURIComponent(email)}`
      ),
    leave: (teamId: string) => http.post(`teams/${teamId}/leave`, {}),
  };
};

export type { TeamRole };
export default useTeamApi;
