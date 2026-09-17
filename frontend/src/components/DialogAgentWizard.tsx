import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiPaperPlaneRight, PiSparkle, PiSpinnerGap } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { BaseProps } from '../@types/common';
import { Agent, WizardMessage } from '../@types/agent';
import useAgentApi from '../hooks/useAgentApi';
import ModalDialog from './ModalDialog';
import ButtonIcon from './ButtonIcon';
import ChatMessageMarkdown from './ChatMessageMarkdown';

type Props = BaseProps & {
  isOpen: boolean;
  onClose: () => void;
  // Called once the wizard has created the agent (parent refreshes + navigates).
  onCreated: (agent: Agent) => void;
};

// A single bubble shown in the wizard transcript. The opening greeting is
// display-only (not part of the messages sent to the interviewer), so it is
// tracked separately from the real exchange.
type DisplayMessage = WizardMessage;

const DialogAgentWizard: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const api = useAgentApi();

  // The real exchange sent to the interviewer (starts with the user's first
  // message). The greeting bubble is prepended only for display.
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const greeting = t('agent.wizard.greeting');

  const displayMessages: DisplayMessage[] = [
    { role: 'assistant', content: greeting },
    ...messages,
  ];

  // Reset the transcript whenever the wizard is (re)opened.
  useEffect(() => {
    if (props.isOpen) {
      setMessages([]);
      setInput('');
      setIsLoading(false);
    }
  }, [props.isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const send = useCallback(() => {
    const content = input.trim();
    if (!content || isLoading) {
      return;
    }
    const nextMessages: WizardMessage[] = [
      ...messages,
      { role: 'user', content },
    ];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    api
      .wizard({ messages: nextMessages })
      .then((res) => {
        const { reply, done, agent } = res.data;
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        if (done && agent) {
          // Give the user a beat to read the confirmation, then hand off.
          setTimeout(() => {
            props.onCreated(agent);
          }, 600);
        }
      })
      .catch((e) => {
        console.error('Agent wizard failed:', e);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: t('agent.wizard.error') },
        ]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [api, input, isLoading, messages, props, t]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  return (
    <ModalDialog
      isOpen={props.isOpen}
      title={t('agent.wizard.title')}
      showCloseIcon
      widthFromContent
      onClose={props.onClose}>
      <div className="flex w-[85vw] max-w-xl flex-col">
        <div
          ref={scrollRef}
          className="flex h-[50vh] flex-col gap-3 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-aws-font-color-light/20 dark:scrollbar-thumb-aws-font-color-dark/20">
          {displayMessages.map((m, idx) => (
            <div
              key={idx}
              className={twMerge(
                'flex',
                m.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
              <div
                className={twMerge(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'whitespace-pre-wrap bg-aws-sea-blue-light text-aws-font-color-white-light dark:bg-aws-ui-color-dark dark:text-aws-font-color-white-dark'
                    : 'bg-light-gray text-aws-font-color-light dark:bg-aws-ui-color-dark dark:text-aws-font-color-dark'
                )}>
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <div className="flex items-start gap-1">
                    {idx === 0 && (
                      <PiSparkle className="mt-1 shrink-0 text-aws-aqua" />
                    )}
                    <ChatMessageMarkdown messageId={`wizard-${idx}`}>
                      {m.content}
                    </ChatMessageMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-light-gray px-3 py-2 text-sm text-gray dark:bg-aws-ui-color-dark">
                <PiSpinnerGap className="animate-spin" />
                {t('agent.wizard.thinking')}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-end gap-2 border-t pt-3">
          <textarea
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-aws-font-color-light/30 bg-transparent p-2 text-sm text-aws-font-color-light focus:outline-none focus:ring-1 focus:ring-aws-sea-blue-light dark:text-aws-font-color-dark"
            rows={1}
            placeholder={t('agent.wizard.placeholder')}
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <ButtonIcon
            className="text-xl"
            disabled={input.trim() === '' || isLoading}
            onClick={send}>
            <PiPaperPlaneRight />
          </ButtonIcon>
        </div>
      </div>
    </ModalDialog>
  );
};

export default DialogAgentWizard;
