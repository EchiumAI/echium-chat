import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCrown,
  PiEnvelopeSimple,
  PiPencilLine,
  PiPlus,
  PiShieldCheck,
  PiSignOut,
  PiTrash,
  PiUser,
  PiUsersThree,
  PiX,
} from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { Team, TeamRole } from '../@types/team';
import Button from '../components/Button';
import ButtonIcon from '../components/ButtonIcon';
import InputText from '../components/InputText';
import ModalDialog from '../components/ModalDialog';
import ListPageLayout from '../layouts/ListPageLayout';
import useTeamApi from '../hooks/useTeamApi';
import useWorkspace from '../hooks/useWorkspace';
import useSnackbar from '../hooks/useSnackbar';

const roleIcon = (role: TeamRole) =>
  role === 'owner' ? (
    <PiCrown className="text-amber-500" />
  ) : role === 'admin' ? (
    <PiShieldCheck className="text-aws-sea-blue-light" />
  ) : (
    <PiUser className="text-gray" />
  );

/**
 * Team administration: who belongs to which team and with which role.
 * Managers (owner/admin) can invite by email, change roles and remove
 * members; the owner can rename or delete the team; others can leave.
 */
const TeamsPage: React.FC = () => {
  const { t } = useTranslation();
  const api = useTeamApi();
  const { open: openSnackbar } = useSnackbar();
  const { refreshWorkspaces, selectWorkspace } = useWorkspace();

  const { data: teams, isLoading, mutate: mutateTeams } = api.teams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail, mutate: mutateDetail } = api.team(selectedId);

  // Keep a sensible selection as the list changes.
  useEffect(() => {
    if (!teams || teams.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !teams.some((x) => x.id === selectedId)) {
      setSelectedId(teams[0].id);
    }
  }, [teams, selectedId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [busy, setBusy] = useState(false);

  const canManage = detail?.myRole === 'owner' || detail?.myRole === 'admin';
  const isOwner = detail?.myRole === 'owner';

  const refreshAll = useCallback(async () => {
    await Promise.all([mutateTeams(), mutateDetail(), refreshWorkspaces()]);
  }, [mutateTeams, mutateDetail, refreshWorkspaces]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMessage?: string) => {
      setBusy(true);
      try {
        await fn();
        await refreshAll();
        if (okMessage) {
          openSnackbar(okMessage);
        }
      } catch (e) {
        const detailMsg =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (e as any)?.response?.data?.detail ??
          (e as Error)?.message ??
          t('team.error.generic');
        openSnackbar(String(detailMsg));
      } finally {
        setBusy(false);
      }
    },
    [refreshAll, openSnackbar, t]
  );

  const onCreate = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    setCreateOpen(false);
    setNewName('');
    run(async () => {
      const res = await api.createTeam(name);
      setSelectedId(res.data.id);
    }, t('team.created', { name }));
  };

  const onInvite = () => {
    const email = inviteEmail.trim();
    if (!email || !selectedId) {
      return;
    }
    setInviteEmail('');
    run(
      () => api.invite(selectedId, email, inviteRole),
      t('team.invited', { email })
    );
  };

  const onRename = (team: Team) => {
    const name = window.prompt(t('team.renamePrompt'), team.name);
    if (!name || !name.trim() || name.trim() === team.name) {
      return;
    }
    run(() => api.renameTeam(team.id, name.trim()));
  };

  const onDelete = (team: Team) => {
    if (!window.confirm(t('team.deleteConfirm', { name: team.name }))) {
      return;
    }
    run(async () => {
      await api.deleteTeam(team.id);
      selectWorkspace('default');
    }, t('team.deleted', { name: team.name }));
  };

  const onLeave = (team: Team) => {
    if (!window.confirm(t('team.leaveConfirm', { name: team.name }))) {
      return;
    }
    run(async () => {
      await api.leave(team.id);
      selectWorkspace('default');
    });
  };

  const sortedMembers = useMemo(() => {
    const order: Record<TeamRole, number> = { owner: 0, admin: 1, member: 2 };
    return [...(detail?.members ?? [])].sort(
      (a, b) => order[a.role] - order[b.role] || a.email.localeCompare(b.email)
    );
  }, [detail]);

  return (
    <>
      <ModalDialog
        isOpen={createOpen}
        title={t('team.create')}
        showCloseIcon
        onClose={() => setCreateOpen(false)}>
        <div className="flex w-full flex-col gap-3">
          <InputText
            label={t('team.nameLabel')}
            value={newName}
            placeholder={t('team.namePlaceholder')}
            onChange={setNewName}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <div className="flex justify-end gap-2">
            <Button outlined onClick={() => setCreateOpen(false)}>
              {t('button.cancel')}
            </Button>
            <Button onClick={onCreate} disabled={!newName.trim()}>
              {t('team.create')}
            </Button>
          </div>
        </div>
      </ModalDialog>

      <ListPageLayout
        pageTitle={t('team.pageTitle')}
        pageTitleHelp={t('team.help')}
        pageTitleActions={
          <Button
            className="text-sm"
            icon={<PiPlus />}
            onClick={() => setCreateOpen(true)}>
            {t('team.create')}
          </Button>
        }
        isLoading={isLoading}
        isEmpty={(teams?.length ?? 0) === 0}
        emptyMessage={t('team.empty')}>
        <div className="flex flex-col gap-4 pt-3 lg:flex-row">
          {/* Team list */}
          <div className="w-full shrink-0 lg:w-72">
            <div className="rounded-lg border border-gray">
              {(teams ?? []).map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedId(team.id)}
                  className={twMerge(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10',
                    team.id === selectedId &&
                      'bg-aws-sea-blue-light/10 font-medium text-aws-font-color-blue'
                  )}>
                  <PiUsersThree className="shrink-0 text-aws-sea-blue-light" />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <span className="shrink-0 text-xs text-gray">
                    {t('team.memberCount', { count: team.memberCount })}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Team detail */}
          {detail && (
            <div className="min-w-0 flex-1 rounded-lg border border-gray p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{detail.name}</h2>
                  <span className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs text-gray dark:bg-white/10">
                    {roleIcon(detail.myRole)}
                    {t(`team.role.${detail.myRole}`)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    outlined
                    className="text-xs"
                    onClick={() => {
                      selectWorkspace(detail.id);
                      window.location.assign('/documents');
                    }}>
                    {t('team.openFiles')}
                  </Button>
                  {canManage && (
                    <ButtonIcon onClick={() => onRename(detail)}>
                      <PiPencilLine />
                    </ButtonIcon>
                  )}
                  {isOwner ? (
                    <ButtonIcon onClick={() => onDelete(detail)}>
                      <PiTrash />
                    </ButtonIcon>
                  ) : (
                    <ButtonIcon onClick={() => onLeave(detail)}>
                      <PiSignOut />
                    </ButtonIcon>
                  )}
                </div>
              </div>

              {/* Invite */}
              {canManage && (
                <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg bg-black/5 p-3 dark:bg-white/5">
                  <div className="min-w-56 flex-1">
                    <InputText
                      label={t('team.inviteLabel')}
                      icon={<PiEnvelopeSimple />}
                      value={inviteEmail}
                      placeholder="name@company.com"
                      onChange={setInviteEmail}
                      onKeyDown={(e) => e.key === 'Enter' && onInvite()}
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as 'admin' | 'member')
                    }
                    className="h-9 rounded border border-aws-font-color-light/50 bg-white px-2 text-sm dark:border-aws-font-color-dark/50 dark:bg-aws-ui-color-dark">
                    <option value="member">{t('team.role.member')}</option>
                    <option value="admin">{t('team.role.admin')}</option>
                  </select>
                  <Button
                    className="text-sm"
                    icon={<PiPlus />}
                    loading={busy}
                    disabled={!inviteEmail.trim()}
                    onClick={onInvite}>
                    {t('team.invite')}
                  </Button>
                  <div className="w-full text-xs text-gray">
                    {t('team.inviteHint')}
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="mb-1 text-sm font-semibold">
                {t('team.members')}{' '}
                <span className="text-xs font-normal text-gray">
                  ({sortedMembers.length})
                </span>
              </div>
              <div className="rounded-lg border border-gray">
                {sortedMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="shrink-0">{roleIcon(m.role)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {m.email || m.userId}
                    </span>
                    {canManage && m.role !== 'owner' ? (
                      <>
                        <select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) =>
                            run(() =>
                              api.setRole(
                                detail.id,
                                m.userId,
                                e.target.value as 'admin' | 'member'
                              )
                            )
                          }
                          className="h-8 rounded border border-aws-font-color-light/30 bg-white px-1 text-xs dark:border-aws-font-color-dark/30 dark:bg-aws-ui-color-dark">
                          <option value="member">{t('team.role.member')}</option>
                          <option value="admin">{t('team.role.admin')}</option>
                        </select>
                        <ButtonIcon
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                t('team.removeConfirm', { email: m.email })
                              )
                            ) {
                              run(() => api.removeMember(detail.id, m.userId));
                            }
                          }}>
                          <PiX />
                        </ButtonIcon>
                      </>
                    ) : (
                      <span className="text-xs text-gray">
                        {t(`team.role.${m.role}`)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Pending invites */}
              {canManage && detail.invites.length > 0 && (
                <>
                  <div className="mb-1 mt-4 text-sm font-semibold">
                    {t('team.pending')}{' '}
                    <span className="text-xs font-normal text-gray">
                      ({detail.invites.length})
                    </span>
                  </div>
                  <div className="rounded-lg border border-dashed border-gray">
                    {detail.invites.map((inv) => (
                      <div
                        key={inv.email}
                        className="flex items-center gap-2 px-3 py-2 text-sm">
                        <PiEnvelopeSimple className="shrink-0 text-gray" />
                        <span className="min-w-0 flex-1 truncate">
                          {inv.email}
                        </span>
                        <span className="text-xs text-gray">
                          {t(`team.role.${inv.role}`)}
                        </span>
                        <ButtonIcon
                          disabled={busy}
                          onClick={() =>
                            run(() => api.revokeInvite(detail.id, inv.email))
                          }>
                          <PiX />
                        </ButtonIcon>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </ListPageLayout>
    </>
  );
};

export default TeamsPage;
