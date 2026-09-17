import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BaseProps } from '../@types/common';
import { Agent } from '../@types/agent';
import useAgent from '../hooks/useAgent';
import ModalDialog from './ModalDialog';
import InputText from './InputText';
import Textarea from './Textarea';
import Button from './Button';

type Props = BaseProps & {
  isOpen: boolean;
  // The agent being edited (undefined => modal closed / nothing to edit).
  agent?: Agent;
  onClose: () => void;
};

const DialogAgentEdit: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { updateAgent } = useAgent();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [memory, setMemory] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the agent's current values whenever the modal opens for an agent.
  useEffect(() => {
    if (props.isOpen && props.agent) {
      setName(props.agent.name);
      setDescription(props.agent.description ?? '');
      setInstruction(props.agent.instruction ?? '');
      setMemory(props.agent.memory ?? '');
      setSaving(false);
    }
  }, [props.isOpen, props.agent]);

  const onSave = () => {
    if (!props.agent || name.trim() === '' || saving) {
      return;
    }
    setSaving(true);
    updateAgent(props.agent.id, {
      name: name.trim(),
      description: description.trim(),
      instruction,
      memory,
      // Preserve fields not exposed in this form.
      model: props.agent.model ?? undefined,
      tools: props.agent.tools,
    })
      .then(() => {
        props.onClose();
      })
      .catch((e) => {
        console.error('Failed to update agent:', e);
        setSaving(false);
      });
  };

  return (
    <ModalDialog
      isOpen={props.isOpen}
      title={t('agent.edit.title')}
      showCloseIcon
      widthFromContent
      onClose={props.onClose}>
      <div className="flex w-[85vw] max-w-xl flex-col gap-4">
        <InputText
          label={t('agent.edit.name')}
          value={name}
          onChange={setName}
        />
        <Textarea
          label={t('agent.edit.description')}
          rows={2}
          value={description}
          onChange={setDescription}
        />
        <Textarea
          label={t('agent.edit.instruction')}
          rows={5}
          value={instruction}
          onChange={setInstruction}
        />
        <Textarea
          label={t('agent.edit.memory')}
          hint={t('agent.edit.memoryHint')}
          rows={5}
          value={memory}
          onChange={setMemory}
        />

        <div className="mt-1 flex justify-end gap-2">
          <Button outlined onClick={props.onClose}>
            {t('button.cancel')}
          </Button>
          <Button
            disabled={name.trim() === '' || saving}
            loading={saving}
            onClick={onSave}>
            {t('agent.edit.save')}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default DialogAgentEdit;
