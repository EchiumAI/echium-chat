import { BaseProps } from '../@types/common';
import useModel from '../hooks/useModel';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react/jsx-runtime';
import { useMemo, useEffect, useState } from 'react';
import { PiCaretDown, PiCheck, PiLock } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActiveModels } from '../@types/bot';
import { toCamelCase } from '../utils/StringUtils';
import useSubscription from '../hooks/useSubscription';
import { isModelAllowedByTiers } from '../constants/plans';
import ModalDialog from './ModalDialog';
import Button from './Button';

interface Props extends BaseProps {
  activeModels: ActiveModels;
  botId?: string | null;
}

const SwitchBedrockModel: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    availableModels: allModels,
    modelId,
    setModelId,
    getDefaultModel,
  } = useModel(props.botId, props.activeModels);

  const { subscription } = useSubscription();
  // Only gate the UI when enforcement is actually on and this user is not a
  // privileged (Unlimited/admin) bypass user.
  const gatingActive =
    !!subscription && subscription.enforcementEnabled && !subscription.unlimited;
  const allowedTiers = useMemo(
    () => subscription?.capabilities.modelTiers ?? [],
    [subscription]
  );

  const isLocked = useMemo(
    () => (id: string) =>
      gatingActive && !isModelAllowedByTiers(id, allowedTiers),
    [gatingActive, allowedTiers]
  );

  // Model whose upgrade dialog is open (null = closed).
  const [lockedModelLabel, setLockedModelLabel] = useState<string | null>(null);

  const availableModels = useMemo(() => {
    return allModels.filter((model) => {
      if (props.activeModels) {
        return (
          props.activeModels[
            toCamelCase(model.modelId) as keyof ActiveModels
          ] === true
        );
      }
      return true;
    });
  }, [allModels, props.activeModels]);

  // Automatically switch to the default model if the current model is not available
  useEffect(() => {
    const isCurrentModelAvailable = availableModels.some(
      (model) => model.modelId === modelId
    );

    if (!isCurrentModelAvailable && availableModels.length > 0) {
      const defaultModelId = getDefaultModel();
      if (defaultModelId && defaultModelId !== modelId) {
        setModelId(defaultModelId);
      }
    }
  }, [availableModels, modelId, setModelId, getDefaultModel]);

  const modelName = useMemo(() => {
    const foundModel = availableModels.find((model) => model.modelId === modelId);
    if (foundModel) {
      return foundModel.label;
    }
    // Only call getDefaultModel if current model is not found
    const defaultModelId = getDefaultModel();
    if (defaultModelId) {
      const defaultModel = availableModels.find((model) => model.modelId === defaultModelId);
      return defaultModel?.label ?? '';
    }
    return '';
  }, [availableModels, modelId, getDefaultModel]);

  return (
    <div className="">
      <Popover className="relative">
        {() => (
          <>
            <Popover.Button
              className={`${
                props.className ?? ''
              } group inline-flex w-auto whitespace-nowrap rounded-lg border border-aws-squid-ink-light/10 dark:border-white/5 bg-aws-paper-light dark:bg-aws-paper-dark/60 px-3 py-1.5 text-sm transition hover:border-aws-squid-ink-light/30 dark:hover:border-white/15 hover:bg-aws-paper-light/80 dark:hover:bg-aws-paper-dark`}>
              <div className="flex items-center justify-between gap-2 text-sm font-medium tracking-tight text-aws-font-color-light/85 dark:text-white/85">
                <span>{modelName}</span>
                <PiCaretDown className="text-xs opacity-60 transition group-hover:opacity-100" />
              </div>
            </Popover.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1">
              <Popover.Panel className="absolute left-0 top-14 z-10 w-96">
                <div className="mt-0.5 overflow-hidden shadow-lg">
                  <div className="flex flex-col whitespace-nowrap rounded border border-aws-font-color-light/50 dark:border-aws-font-color-dark/50 bg-white dark:bg-aws-ui-color-dark text-sm max-h-80 overflow-y-auto">
                    {availableModels.map((model) => {
                      const locked = isLocked(model.modelId);
                      return (
                        <div
                          key={model.modelId}
                          className={`m-1 flex rounded p-1 px-2 ${
                            locked
                              ? 'cursor-not-allowed opacity-40'
                              : 'cursor-pointer hover:bg-light-gray dark:hover:bg-aws-paper-dark'
                          }`}
                          onClick={() => {
                            if (locked) {
                              setLockedModelLabel(model.label);
                            } else {
                              setModelId(model.modelId);
                            }
                          }}>
                          <div className="mr-3 flex flex-col items-center justify-center">
                            {locked ? (
                              <PiLock />
                            ) : (
                              <PiCheck
                                className={
                                  model.modelId === modelId
                                    ? ''
                                    : 'text-transparent'
                                }
                              />
                            )}
                          </div>
                          <div>
                            <div className="block text-left font-semibold">
                              <span>{model.label}</span>
                              {locked && (
                                <span className="ml-2 text-xs font-normal text-amber-500">
                                  {t('pricing.modelLocked')}
                                </span>
                              )}
                            </div>
                            {model.description && (
                              <div className="block whitespace-normal text-left text-xs text-dark-gray dark:text-aws-font-color-dark">
                                <span>{model.description}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>

      <ModalDialog
        isOpen={lockedModelLabel !== null}
        title={t('pricing.upgradeTitle')}
        onClose={() => setLockedModelLabel(null)}>
        <div className="flex flex-col gap-4">
          <div className="text-sm">
            {t('pricing.upgradeBody', { model: lockedModelLabel ?? '' })}
          </div>
          <div className="flex justify-end gap-2">
            <Button outlined onClick={() => setLockedModelLabel(null)}>
              {t('button.cancel')}
            </Button>
            <Button
              onClick={() => {
                setLockedModelLabel(null);
                navigate('/account');
              }}>
              {t('pricing.upgradeCta')}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};

export default SwitchBedrockModel;
