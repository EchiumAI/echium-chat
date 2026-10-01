export type TeamRole = 'owner' | 'admin' | 'member';

export type Team = {
  id: string;
  name: string;
  workspaceId: string;
  ownerUserId: string;
  myRole: TeamRole;
  memberCount: number;
  createTime: number;
  updateTime: number;
};

export type TeamMember = {
  userId: string;
  email: string;
  role: TeamRole;
  joinedAt: number;
};

export type TeamInvite = {
  email: string;
  role: TeamRole;
  invitedBy: string;
  createTime: number;
};

export type TeamDetail = Team & {
  members: TeamMember[];
  invites: TeamInvite[];
};

export type WorkspaceOverview = {
  workspaceId: string;
  name: string;
  kind: 'personal' | 'team';
  isDefault: boolean;
  teamId?: string | null;
  role?: TeamRole | null;
};
