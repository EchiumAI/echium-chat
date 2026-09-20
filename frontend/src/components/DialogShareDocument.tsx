import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiRobot } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { BaseProps } from '../@types/common';
import { WorkspaceDocument } from '../@types/workspaceDocument';
import useAgent from '../hooks/useAgent';
import ModalDialog from './ModalDialog';
import Button from './Button';

type Props = BaseProps & {
  isOpen: boolean;
  document?: WorkspaceDocument;
  onClose: () => void;
  onSave: (allowedAgentIds: string[], allAgents: boolean) => void;
};

const DialogShareDocument: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { agents } = useAgent();

  const [allAgents, setAllAgents] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (props.isOpen && props.document) {
      setAllAgents(props.document.allAgents);
      setSelected(new Set(props.document.allowedAgentIds));
    }
  }, [props.isOpen, props.document]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ModalDialog
      isOpen={props.isOpen}
      title={t('document.share.title')}
      showCloseIcon
      onClose={props.onClose}>
      <div className="flex w-full flex-col gap-3">
        <div className="text-sm text-gray">{t('document.share.hint')}</div>

        <label className="flex cursor-pointer items-center gap-2 rounded border border-gray p-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-aws-sea-blue-light"
            checked={allAgents}
            onChange={(e) => setAllAgents(e.target.checked)}
          />
          <span className="font-medium">{t('document.share.allAgents')}</span>
        </label>

        <div
          className={twMerge(
            'flex max-h-72 flex-col gap-1 overflow-y-auto',
            allAgents && 'pointer-events-none opacity-40'
          )}>
          {(agents ?? []).length === 0 && (
            <div className="p-2 text-xs text-gray">
              {t('document.share.noAgents')}
            </div>
          )}
          {(agents ?? []).map((agent) => (
            <label
              key={agent.id}
              className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-light-gray dark:hover:bg-aws-ui-color-dark">
              <input
                type="checkbox"
                className="size-4 accent-aws-sea-blue-light"
                checked={selected.has(agent.id)}
                onChange={() => toggle(agent.id)}
              />
              <PiRobot className="shrink-0 text-aws-sea-blue-light" />
              <span className="truncate">{agent.name}</span>
            </label>
          ))}
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button outlined onClick={props.onClose}>
            {t('button.cancel')}
          </Button>
          <Button
            onClick={() => props.onSave(Array.from(selected), allAgents)}>
            {t('document.share.save')}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default DialogShareDocument;
