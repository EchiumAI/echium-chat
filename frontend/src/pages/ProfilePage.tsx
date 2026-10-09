import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiTrash } from 'react-icons/pi';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import Toggle from '../components/Toggle';
import ListPageLayout from '../layouts/ListPageLayout';
import useProfileApi from '../hooks/useProfileApi';
import useAgentApi from '../hooks/useAgentApi';
import useSnackbar from '../hooks/useSnackbar';
import { UserProfileInput } from '../@types/profile';

const EMPTY: UserProfileInput = {
  enabled: true,
  profile: '',
  sensitive: '',
  sensitiveConsent: false,
  shareAllAgents: true,
  allowedAgentIds: [],
};

/**
 * Profile & memory: one short description of the user that Echium uses to
 * personalise answers. The user can edit it, switch it off, choose which
 * agents see it, and opt in (separately, explicitly) to sensitive information.
 */
const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const api = useProfileApi();
  const agentApi = useAgentApi();
  const { open: openSnackbar } = useSnackbar();

  const { data, isLoading, mutate } = api.profile();
  const { data: agents } = agentApi.agents();

  const [form, setForm] = useState<UserProfileInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        enabled: data.enabled,
        profile: data.profile,
        sensitive: data.sensitive,
        sensitiveConsent: data.sensitiveConsent,
        shareAllAgents: data.shareAllAgents,
        allowedAgentIds: data.allowedAgentIds,
      });
    }
  }, [data]);

  const set = <K extends keyof UserProfileInput>(
    key: K,
    value: UserProfileInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const onSensitiveToggle = (on: boolean) => {
    if (!on && (form.sensitive.trim() || data?.sensitiveConsent)) {
      if (!window.confirm(t('profile.sensitive.withdrawConfirm'))) {
        return;
      }
    }
    setForm((f) => ({
      ...f,
      sensitiveConsent: on,
      sensitive: on ? f.sensitive : '',
    }));
  };

  const toggleAgent = (id: string) =>
    setForm((f) => ({
      ...f,
      allowedAgentIds: f.allowedAgentIds.includes(id)
        ? f.allowedAgentIds.filter((x) => x !== id)
        : [...f.allowedAgentIds, id],
    }));

  const onSave = async () => {
    setBusy(true);
    try {
      await api.updateProfile(form);
      await mutate();
      openSnackbar(t('profile.saved'));
    } catch (e) {
      const detail =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e as any)?.response?.data?.detail ?? t('profile.error');
      openSnackbar(String(detail));
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    if (!window.confirm(t('profile.clearConfirm'))) {
      return;
    }
    setBusy(true);
    try {
      await api.clearProfile();
      await mutate();
      setForm(EMPTY);
      openSnackbar(t('profile.cleared'));
    } catch {
      openSnackbar(t('profile.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListPageLayout
      pageTitle={t('profile.pageTitle')}
      pageTitleHelp={t('profile.help')}
      isLoading={isLoading}>
      <div className="flex max-w-3xl flex-col gap-6 pt-3">
        <section className="rounded-lg border border-gray p-4">
          <Toggle
            value={form.enabled}
            label={t('profile.enabled')}
            hint={t('profile.enabledHint')}
            onChange={(v) => set('enabled', v)}
          />
        </section>

        <section className="rounded-lg border border-gray p-4">
          <h2 className="mb-1 font-semibold">{t('profile.about')}</h2>
          <p className="mb-3 text-sm text-gray">{t('profile.aboutHint')}</p>
          <Textarea
            value={form.profile}
            rows={10}
            placeholder={t('profile.placeholder')}
            disabled={!form.enabled}
            onChange={(v) => set('profile', v)}
          />
          {data && data.updateTime > 0 && (
            <div className="mt-2 text-xs text-gray">
              {t('profile.lastUpdated', {
                date: new Date(data.updateTime * 1000).toLocaleString(),
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray p-4">
          <h2 className="mb-1 font-semibold">{t('profile.sharing.title')}</h2>
          <p className="mb-2 text-sm text-gray">{t('profile.sharing.hint')}</p>
          <Toggle
            value={form.shareAllAgents}
            label={t('profile.sharing.allAgents')}
            disabled={!form.enabled}
            onChange={(v) => set('shareAllAgents', v)}
          />
          {!form.shareAllAgents && (
            <div className="mt-2 flex flex-col gap-1">
              {(agents ?? []).length === 0 && (
                <div className="text-sm text-gray">
                  {t('profile.sharing.noAgents')}
                </div>
              )}
              {(agents ?? []).map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allowedAgentIds.includes(agent.id)}
                    disabled={!form.enabled}
                    onChange={() => toggleAgent(agent.id)}
                  />
                  {agent.name}
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray p-4">
          <h2 className="mb-1 font-semibold">{t('profile.sensitive.title')}</h2>
          <p className="mb-2 text-sm text-gray">
            {t('profile.sensitive.explanation')}
          </p>
          <Toggle
            value={form.sensitiveConsent}
            label={t('profile.sensitive.consent')}
            disabled={!form.enabled}
            onChange={onSensitiveToggle}
          />
          {data?.sensitiveConsent && data.consentTime && (
            <div className="mb-2 text-xs text-gray">
              {t('profile.sensitive.consentedOn', {
                date: new Date(data.consentTime * 1000).toLocaleString(),
              })}
            </div>
          )}
          {form.sensitiveConsent && (
            <Textarea
              value={form.sensitive}
              rows={4}
              placeholder={t('profile.sensitive.placeholder')}
              disabled={!form.enabled}
              onChange={(v) => set('sensitive', v)}
            />
          )}
        </section>

        <div className="flex flex-wrap justify-between gap-2">
          <Button outlined icon={<PiTrash />} onClick={onClear} disabled={busy}>
            {t('profile.clear')}
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {t('profile.save')}
          </Button>
        </div>
      </div>
    </ListPageLayout>
  );
};

export default ProfilePage;
