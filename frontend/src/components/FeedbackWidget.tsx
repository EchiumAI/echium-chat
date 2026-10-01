import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiBugBeetle, PiChatTeardropText, PiLightbulb, PiX } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import useHttp from '../hooks/useHttp';
import useSnackbar from '../hooks/useSnackbar';

type FeedbackType = 'bug' | 'idea';

/**
 * Always-visible floating "Feedback" button (bottom-right) for alpha users.
 * Opens a compact panel: Bug / Idea, a message, Send. Everything else (app,
 * route, browser) is captured automatically. The backend stores it and files a
 * GitHub issue in the right product repo.
 */
const FeedbackWidget: React.FC = () => {
  const { t } = useTranslation();
  const http = useHttp();
  const { open: openSnackbar } = useSnackbar();

  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the message so a user can just start typing.
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Esc closes the panel.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const send = useCallback(async () => {
    const text = message.trim();
    if (!text || sending) {
      return;
    }
    setSending(true);
    try {
      await http.post('feedback', {
        app: 'chat',
        type,
        message: text,
        route: window.location.pathname,
        userAgent: navigator.userAgent.slice(0, 500),
        version: import.meta.env.VITE_APP_VERSION ?? undefined,
      });
      setMessage('');
      setIsOpen(false);
      openSnackbar(t('feedbackWidget.thanks'));
    } catch (e) {
      console.error('Feedback submit failed', e);
      openSnackbar(t('feedbackWidget.failed'));
    } finally {
      setSending(false);
    }
  }, [message, sending, type, http, openSnackbar, t]);

  const typeButton = (value: FeedbackType, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setType(value)}
      className={twMerge(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
        type === value
          ? 'border-aws-sea-blue-light bg-aws-sea-blue-light text-white dark:border-aws-sea-blue-dark dark:bg-aws-sea-blue-dark'
          : 'border-black/10 text-aws-font-color-light hover:bg-black/5 dark:border-white/15 dark:text-aws-font-color-dark dark:hover:bg-white/10'
      )}>
      {icon}
      {t(`feedbackWidget.${value}`)}
    </button>
  );

  return (
    <>
      {/* Floating trigger — fixed so it is on every screen, above the input. */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={t('feedbackWidget.title')}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-aws-sea-blue-light px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-aws-sea-blue-hover-light md:bottom-6 dark:bg-aws-sea-blue-dark">
          <PiChatTeardropText className="text-lg" />
          <span>{t('feedbackWidget.button')}</span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label={t('feedbackWidget.title')}
          className="fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-black/10 bg-white p-4 shadow-2xl md:bottom-6 dark:border-white/10 dark:bg-aws-ui-color-dark">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-aws-font-color-light dark:text-aws-font-color-dark">
              {t('feedbackWidget.title')}
            </h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-aws-font-color-gray hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close">
              <PiX className="text-lg" />
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            {typeButton('bug', <PiBugBeetle className="text-lg" />)}
            {typeButton('idea', <PiLightbulb className="text-lg" />)}
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            rows={4}
            maxLength={5000}
            placeholder={t('feedbackWidget.placeholder')}
            className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-aws-font-color-light outline-none focus:border-aws-sea-blue-light focus:ring-2 focus:ring-aws-sea-blue-light/25 dark:border-white/15 dark:bg-black/20 dark:text-aws-font-color-dark"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-aws-font-color-gray">
              {t('feedbackWidget.notice')}
            </span>
            <button
              type="button"
              onClick={send}
              disabled={sending || !message.trim()}
              className="shrink-0 rounded-lg bg-aws-sea-blue-light px-4 py-2 text-sm font-semibold text-white hover:bg-aws-sea-blue-hover-light disabled:opacity-40 dark:bg-aws-sea-blue-dark">
              {sending ? t('feedbackWidget.sending') : t('feedbackWidget.send')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;
