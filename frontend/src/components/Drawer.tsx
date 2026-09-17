import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BaseProps } from '../@types/common';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useDrawer from '../hooks/useDrawer';
import ButtonIcon from './ButtonIcon';
import {
  PiArrowRight,
  PiCaretDown,
  PiCaretRight,
  PiChartLine,
  PiChat,
  PiChatCenteredDotsDuotone,
  PiCheck,
  PiCompass,
  PiFolder,
  PiFolderPlus,
  PiListBullets,
  PiNotePencil,
  PiPencilLine,
  PiPlus,
  PiPlugs,
  PiPresentationChart,
  PiRobot,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import LazyOutputText from './LazyOutputText';
import { ConversationFolder, ConversationMeta } from '../@types/conversation';
import { BotListItem } from '../@types/bot';
import { isMobile } from 'react-device-detect';
import useChat from '../hooks/useChat';
import useAgent from '../hooks/useAgent';
import { Agent } from '../@types/agent';
import DialogAgentWizard from './DialogAgentWizard';
import DialogAgentEdit from './DialogAgentEdit';
import { useTranslation } from 'react-i18next';
import Menu from './Menu';
import DrawerItem from './DrawerItem';
import ExpandableDrawerGroup from './ExpandableDrawerGroup';
import { usePageLabel } from '../routes';
import { twMerge } from 'tailwind-merge';
import Button from './Button';
import Skeleton from './Skeleton';
import { isPinnedBot } from '../utils/BotUtils';
import IconPinnedBot from './IconPinnedBot';
import useGlobalConfig from '../hooks/useGlobalConfig';

// Bots are not part of the current product offering. Hide every bot-related
// section (My Bots, Discover, Pinned, Starred, Recently Used) in the sidebar
// regardless of the user's drawer preferences. Flip to `true` to bring the
// full bot experience back.
const BOTS_ENABLED = false;

// Custom drag-and-drop MIME type for moving a conversation into a folder.
const CONV_DND_TYPE = 'application/x-echium-conversation-id';

type Props = BaseProps & {
  isAdmin: boolean;
  conversations?: ConversationMeta[];
  folders?: ConversationFolder[];
  pinnedBots?: BotListItem[];
  starredBots?: BotListItem[];
  recentlyUsedUnstarredBots?: BotListItem[];
  updateConversationTitle: (
    conversationId: string,
    title: string
  ) => Promise<void>;
  onSignOut: () => void;
  onDeleteConversation: (conversation: ConversationMeta) => void;
  onClearConversations: () => void;
  onSelectLanguage: () => void;
  onClickDrawerOptions: () => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveConversation: (conversationId: string, folderId: string | null) => void;
};

type ItemProps = BaseProps & {
  label: string;
  conversationId: string;
  generatedTitle?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLAnchorElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLAnchorElement>) => void;
  updateTitle: (conversationId: string, title: string) => Promise<void>;
  onClick: () => void;
  onDelete: () => void;
};

const Item: React.FC<ItemProps> = (props) => {
  const { pathname } = useLocation();
  const { conversationId: pathParam } = useParams();
  const { conversationId } = useChat();
  const [tempLabel, setTempLabel] = useState('');
  const [editing, setEditing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const active = useMemo<boolean>(() => {
    return (
      pathParam === props.conversationId ||
      ((pathname === '/' || pathname.startsWith('/bot/')) &&
        conversationId == props.conversationId)
    );
  }, [conversationId, pathParam, pathname, props.conversationId]);

  const onClickEdit = useCallback(() => {
    setEditing(true);
    setTempLabel(props.label);
  }, [props.label]);

  const onClickUpdate = useCallback(() => {
    props.updateTitle(props.conversationId, tempLabel).then(() => {
      setEditing(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempLabel, props.conversationId, props.updateTitle]);

  const onClickDelete = useCallback(() => {
    props.onDelete();
  }, [props]);

  useLayoutEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  useLayoutEffect(() => {
    if (editing) {
      const listener = (e: DocumentEventMap['keypress']) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();

          // dispatch 処理の中で Title の更新を行う（同期を取るため）
          setTempLabel((newLabel) => {
            props.updateTitle(props.conversationId, newLabel).then(() => {
              setEditing(false);
            });
            return newLabel;
          });
        }
      };
      inputRef.current?.addEventListener('keypress', listener);

      inputRef.current?.focus();

      return () => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputRef.current?.removeEventListener('keypress', listener);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <DrawerItem
      isActive={active}
      isBlur={!editing}
      to={`/${props.conversationId}`}
      draggable={props.draggable && !editing}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onClick={props.onClick}
      icon={<PiChat />}
      labelComponent={
        <>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-transparent"
              value={tempLabel}
              onChange={(e) => {
                setTempLabel(e.target.value);
              }}
            />
          ) : (
            <>
              {props.generatedTitle ? (
                <LazyOutputText text={props.label} />
              ) : (
                <>{props.label}</>
              )}
            </>
          )}
        </>
      }
      actionComponent={
        <>
          {active && !editing && (
            <>
              <ButtonIcon className="text-base" onClick={onClickEdit}>
                <PiPencilLine />
              </ButtonIcon>

              <ButtonIcon className="text-base" onClick={onClickDelete}>
                <PiTrash />
              </ButtonIcon>
            </>
          )}
          {editing && (
            <>
              <ButtonIcon className="text-base" onClick={onClickUpdate}>
                <PiCheck />
              </ButtonIcon>

              <ButtonIcon
                className="text-base"
                onClick={() => {
                  setEditing(false);
                }}>
                <PiX />
              </ButtonIcon>
            </>
          )}
        </>
      }
    />
  );
};

// Persist each folder's expanded/collapsed state across sessions so folders
// reopen where the user left them. Keyed by folder id in localStorage.
const FOLDER_OPEN_STORAGE_KEY = 'echium:folderOpenState';

const readFolderOpenState = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(FOLDER_OPEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

const writeFolderOpenState = (folderId: string, open: boolean) => {
  try {
    const state = readFolderOpenState();
    state[folderId] = open;
    localStorage.setItem(FOLDER_OPEN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (e.g. storage disabled/full).
  }
};

type FolderSectionProps = {
  folder: ConversationFolder;
  children: React.ReactNode;
  onRename: () => void;
  onDelete: () => void;
  onNewChat: () => void;
  onDropConversation: (conversationId: string) => void;
};

const FolderSection: React.FC<FolderSectionProps> = ({
  folder,
  children,
  onRename,
  onDelete,
  onNewChat,
  onDropConversation,
}) => {
  const [open, setOpen] = useState<boolean>(
    () => readFolderOpenState()[folder.id] ?? true
  );
  const [isOver, setIsOver] = useState(false);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      writeFolderOpenState(folder.id, next);
      return next;
    });
  }, [folder.id]);

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(CONV_DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const id = e.dataTransfer.getData(CONV_DND_TYPE);
        if (id) {
          onDropConversation(id);
          setOpen(true);
          writeFolderOpenState(folder.id, true);
        }
      }}
      className={twMerge(
        'rounded',
        isOver && 'bg-aws-sea-blue-dark/40 ring-1 ring-inset ring-white/30'
      )}>
      <div className="group flex items-center justify-between px-2 py-1.5 hover:bg-white/5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
          onClick={toggleOpen}>
          {open ? (
            <PiCaretDown className="shrink-0" />
          ) : (
            <PiCaretRight className="shrink-0" />
          )}
          <PiFolder className="shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        <div className="flex shrink-0 gap-1 lg:hidden lg:group-hover:flex">
          <ButtonIcon className="text-base" onClick={onNewChat}>
            <PiPlus />
          </ButtonIcon>
          <ButtonIcon className="text-base" onClick={onRename}>
            <PiPencilLine />
          </ButtonIcon>
          <ButtonIcon className="text-base" onClick={onDelete}>
            <PiTrash />
          </ButtonIcon>
        </div>
      </div>
      {open && (
        <div className="ml-2 border-l border-white/10 pl-1">{children}</div>
      )}
    </div>
  );
};

// An agent in the sidebar: a header (name + new-chat + delete) with the
// agent's own conversations listed beneath it (collapsible). Agent chats live
// here rather than in the generic chat history.
type AgentSectionProps = {
  agent: Agent;
  conversations: ConversationMeta[];
  generateTitleConvId?: string;
  onNewChat: () => void;
  onEdit: () => void;
  onDelete: () => void;
  updateTitle: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversation: ConversationMeta) => void;
  onClickConversation: () => void;
};

const AgentSection: React.FC<AgentSectionProps> = ({
  agent,
  conversations,
  generateTitleConvId,
  onNewChat,
  onEdit,
  onDelete,
  updateTitle,
  onDeleteConversation,
  onClickConversation,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(true);

  return (
    <div>
      <div className="group flex items-center justify-between px-2 py-1.5 hover:bg-white/5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
          onClick={() => setOpen((o) => !o)}>
          {open ? (
            <PiCaretDown className="shrink-0" />
          ) : (
            <PiCaretRight className="shrink-0" />
          )}
          <PiRobot className="shrink-0" />
          <span className="truncate">{agent.name}</span>
          <span className="shrink-0 text-xs text-white/50">
            ({conversations.length})
          </span>
        </button>
        <div className="flex shrink-0 gap-1 lg:hidden lg:group-hover:flex">
          <ButtonIcon className="text-base" onClick={onNewChat}>
            <PiPlus />
          </ButtonIcon>
          <ButtonIcon className="text-base" onClick={onEdit}>
            <PiPencilLine />
          </ButtonIcon>
          <ButtonIcon className="text-base" onClick={onDelete}>
            <PiTrash />
          </ButtonIcon>
        </div>
      </div>
      {open && (
        <div className="ml-2 border-l border-white/10 pl-1">
          {conversations.length === 0 ? (
            <div className="px-3 py-1 text-xs text-white/50">
              {t('agent.noChatsYet')}
            </div>
          ) : (
            conversations.map((conversation) => (
              <Item
                key={conversation.id}
                className="grow"
                label={conversation.title}
                conversationId={conversation.id}
                generatedTitle={conversation.id === generateTitleConvId}
                updateTitle={updateTitle}
                onClick={onClickConversation}
                onDelete={() => onDeleteConversation(conversation)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const Drawer: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getPageLabel } = usePageLabel();
  const { opened, switchOpen, drawerOptions } = useDrawer();

  // Resizable drawer width (desktop only). Persisted so it stays where the
  // user dragged it; clamped to a readable range.
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('echium:drawerWidth');
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) ? Math.min(Math.max(n, 220), 500) : 256;
    } catch {
      return 256;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      let latest = drawerWidth;
      const onMove = (ev: MouseEvent) => {
        latest = Math.min(Math.max(ev.clientX, 220), 500);
        setDrawerWidth(latest);
      };
      const onUp = () => {
        setIsResizing(false);
        try {
          localStorage.setItem('echium:drawerWidth', String(latest));
        } catch {
          // Ignore storage errors.
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
      };
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [drawerWidth]
  );

  const {
    conversations,
    folders,
    pinnedBots,
    starredBots,
    recentlyUsedUnstarredBots,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveConversation,
  } = props;

  const handleCreateFolder = useCallback(() => {
    const name = window.prompt(t('folder.namePrompt') ?? '');
    if (name && name.trim()) {
      onCreateFolder(name.trim());
    }
  }, [onCreateFolder, t]);

  const handleRenameFolder = useCallback(
    (folder: ConversationFolder) => {
      const name = window.prompt(t('folder.namePrompt') ?? '', folder.name);
      if (name && name.trim() && name.trim() !== folder.name) {
        onRenameFolder(folder.id, name.trim());
      }
    },
    [onRenameFolder, t]
  );

  const handleDeleteFolder = useCallback(
    (folder: ConversationFolder) => {
      if (window.confirm(t('folder.deleteConfirm', { name: folder.name }))) {
        onDeleteFolder(folder.id);
      }
    },
    [onDeleteFolder, t]
  );

  const handleDragStart = useCallback(
    (conversationId: string) => (e: React.DragEvent<HTMLAnchorElement>) => {
      e.dataTransfer.setData(CONV_DND_TYPE, conversationId);
      e.dataTransfer.setData('text/plain', conversationId);
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const [isUnfiledOver, setIsUnfiledOver] = useState(false);

  const location = useLocation();

  const [prevConversations, setPrevConversations] =
    useState<typeof conversations>();
  const [generateTitleIndex, setGenerateTitleIndex] = useState(-1);

  const generateTitleConvId = useMemo(
    () =>
      generateTitleIndex >= 0
        ? conversations?.[generateTitleIndex]?.id
        : undefined,
    [conversations, generateTitleIndex]
  );

  const { newChat, conversationId } = useChat();
  const { botId } = useParams();

  // Sidebar Chats | Agents toggle: swap the drawer body between the chat
  // history and the list of the user's agents (click an agent to chat).
  const [drawerTab, setDrawerTab] = useState<'chats' | 'agents'>('chats');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>();
  const {
    agents,
    isLoadingAgents,
    mutateAgents,
    deleteAgent: removeAgent,
  } = useAgent();

  const onClickAgent = useCallback(
    (agent: Agent) => {
      newChat();
      navigate(`/agent/${agent.id}`);
      closeSmallDrawer();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate]
  );

  const onClickDeleteAgent = useCallback(
    (agent: Agent) => {
      if (window.confirm(t('agent.deleteConfirm', { name: agent.name }))) {
        removeAgent(agent.id).catch(() => {});
      }
    },
    [removeAgent, t]
  );

  const onAgentCreated = useCallback(
    (agent: Agent) => {
      setIsWizardOpen(false);
      mutateAgents();
      newChat();
      navigate(`/agent/${agent.id}`);
      closeSmallDrawer();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, mutateAgents]
  );
  const { getGlobalConfig } = useGlobalConfig();
  const { data: globalConfig } = getGlobalConfig();
  const logoSrc = globalConfig?.logoPath ?? '';

  useEffect(() => {
    setPrevConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    // 新規チャットの場合はTitleをLazy表示にする
    if (!conversations || !prevConversations) {
      return;
    }
    if (conversations.length > prevConversations?.length) {
      setGenerateTitleIndex(
        conversations?.findIndex(
          (c) =>
            (prevConversations?.findIndex((pc) => c.id === pc.id) ?? -1) < 0
        ) ?? -1
      );
    }
  }, [conversations, prevConversations]);

  const onClickNewChat = useCallback(() => {
    newChat();
    closeSmallDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClickNewBotChat = useCallback(
    () => {
      newChat();
      closeSmallDrawer();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const smallDrawer = useRef<HTMLDivElement>(null);

  const closeSmallDrawer = useCallback(() => {
    if (smallDrawer.current?.classList.contains('visible')) {
      switchOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClickLogo = useCallback(() => {
    navigate('/');
    closeSmallDrawer();
  }, [navigate, closeSmallDrawer]);

  useLayoutEffect(() => {
    // リサイズイベントを拾って状態を更新する
    const onResize = () => {
      if (isMobile) {
        return;
      }

      // 狭い画面のDrawerが表示されていて、画面サイズが大きくなったら状態を更新
      if (!smallDrawer.current?.checkVisibility() && opened) {
        switchOpen();
      }
    };
    onResize();

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const isAdminPanel = useMemo(() => {
    return location.pathname.startsWith('/admin');
  }, [location.pathname]);

  return (
    <>
      <DialogAgentWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCreated={onAgentCreated}
      />
      <DialogAgentEdit
        isOpen={!!editingAgent}
        agent={editingAgent}
        onClose={() => setEditingAgent(undefined)}
      />
      <div
        className="relative h-full overflow-y-auto bg-aws-squid-ink-light scrollbar-thin scrollbar-track-white scrollbar-thumb-aws-squid-ink-light/30 dark:bg-aws-ui-color-dark dark:scrollbar-thumb-aws-ui-color-dark/30"
        style={{ '--drawer-width': `${drawerWidth}px` } as React.CSSProperties}>
        <nav
          className={twMerge(
            'text-sm text-white lg:visible lg:w-[var(--drawer-width)]',
            !isResizing && 'transition-width',
            opened ? 'visible w-64' : 'invisible w-0'
          )}>
          <div className="sticky top-0 z-10 flex items-center justify-center border-b border-white/10 bg-aws-squid-ink-light px-4 py-6 dark:bg-aws-squid-ink-dark">
            <button
              type="button"
              onClick={onClickLogo}
              className="flex w-full items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-transparent">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt=""
                  className="size-8 shrink-0 rounded-full"
                  loading="lazy"
                />
              )}
              <span className="truncate text-base font-semibold text-white">
                {t('app.name')}
              </span>
            </button>
          </div>
          {!isAdminPanel && (
            <>
              {drawerOptions.show.newChat && (
                <DrawerItem
                  isActive={false}
                  icon={<PiNotePencil />}
                  to="/"
                  onClick={onClickNewChat}
                  labelComponent={t('button.newChat')}
                />
              )}
              {/* Chats | Agents toggle */}
              <div className="m-2 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setDrawerTab('chats')}
                  className={twMerge(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    drawerTab === 'chats'
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:text-white'
                  )}>
                  <PiChat />
                  {t('app.conversationHistory')}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('agents')}
                  className={twMerge(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    drawerTab === 'agents'
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:text-white'
                  )}>
                  <PiRobot />
                  {t('agent.tab')}
                </button>
              </div>
              {BOTS_ENABLED && drawerOptions.show.myBots && (
                <DrawerItem
                  isActive={false}
                  icon={<PiListBullets />}
                  to="/bot/my"
                  labelComponent={getPageLabel('/bot/my')}
                  onClick={closeSmallDrawer}
                />
              )}
              {BOTS_ENABLED && drawerOptions.show.discoverBots && (
                <DrawerItem
                  isActive={false}
                  icon={<PiCompass />}
                  to="/bot/discover"
                  labelComponent={getPageLabel('/bot/discover')}
                  onClick={closeSmallDrawer}
                />
              )}

              {BOTS_ENABLED &&
              drawerOptions.show.pinnedBots &&
              pinnedBots?.filter((bot) => bot.available).length ? (
                <ExpandableDrawerGroup
                  label={t('app.pinnedBots')}
                  className="border-t bg-aws-squid-ink-light pt-1 dark:bg-aws-squid-ink-dark">
                  {pinnedBots
                    .filter((bot) => bot.available)
                    .map((bot) => (
                      <DrawerItem
                        key={bot.id}
                        isActive={botId === bot.id && !conversationId}
                        to={`/bot/${bot.id}`}
                        icon={<IconPinnedBot showAlways />}
                        labelComponent={bot.title}
                        onClick={onClickNewBotChat}
                      />
                    ))}
                </ExpandableDrawerGroup>
              ) : null}

              {BOTS_ENABLED && drawerOptions.show.starredBots && (
                <ExpandableDrawerGroup
                  label={t('app.starredBots')}
                  className="border-t bg-aws-squid-ink-light pt-1 dark:bg-aws-squid-ink-dark">
                  {starredBots === undefined && (
                    <div className="flex flex-col gap-2 p-2">
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                    </div>
                  )}
                  {starredBots
                    ?.slice(0, drawerOptions.displayCount.starredBots)
                    .map((bot) => (
                      <DrawerItem
                        key={bot.id}
                        isActive={botId === bot.id && !conversationId}
                        to={`/bot/${bot.id}`}
                        icon={
                          isPinnedBot(bot.sharedStatus) ? (
                            <IconPinnedBot showAlways />
                          ) : (
                            <PiRobot />
                          )
                        }
                        labelComponent={bot.title}
                        onClick={onClickNewBotChat}
                      />
                    ))}

                  {starredBots && starredBots.length > 15 && (
                    <Button
                      text
                      rightIcon={<PiArrowRight />}
                      className="w-full"
                      onClick={() => {
                        navigate('/bot/starred');
                        closeSmallDrawer();
                      }}>
                      {t('bot.button.viewAll')}
                    </Button>
                  )}
                </ExpandableDrawerGroup>
              )}

              {BOTS_ENABLED && drawerOptions.show.recentlyUsedBots && (
                <ExpandableDrawerGroup
                  label={t('app.recentlyUsedBots')}
                  className="border-t bg-aws-squid-ink-light pt-1 dark:bg-aws-squid-ink-dark ">
                  {recentlyUsedUnstarredBots === undefined && (
                    <div className="flex flex-col gap-2 p-2">
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                    </div>
                  )}
                  {recentlyUsedUnstarredBots
                    ?.slice(0, drawerOptions.displayCount.recentlyUsedBots)
                    .map((bot) => (
                      <DrawerItem
                        key={bot.id}
                        isActive={false}
                        to={`/bot/${bot.id}`}
                        icon={
                          isPinnedBot(bot.sharedStatus) ? (
                            <IconPinnedBot showAlways />
                          ) : (
                            <PiRobot />
                          )
                        }
                        labelComponent={bot.title}
                        onClick={onClickNewBotChat}
                      />
                    ))}

                  {recentlyUsedUnstarredBots && (
                    <Button
                      text
                      rightIcon={<PiArrowRight />}
                      className="w-full"
                      onClick={() => {
                        navigate('/bot/recently-used');
                        closeSmallDrawer();
                      }}>
                      {t('bot.button.viewAll')}
                    </Button>
                  )}
                </ExpandableDrawerGroup>
              )}

              {drawerTab === 'agents' && (
                <div
                  className={twMerge(
                    'border-t border-white/10 pt-1',
                    props.isAdmin ? 'mb-20' : 'mb-10'
                  )}>
                  <div className="flex items-center justify-between px-2 py-1 text-xs text-white/70">
                    <span className="font-semibold uppercase tracking-wider">
                      {t('agent.tab')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsWizardOpen(true)}
                      className="flex items-center gap-1 rounded p-1 hover:bg-white/5">
                      <PiPlus className="text-base" />
                      {t('agent.new')}
                    </button>
                  </div>

                  {isLoadingAgents && agents === undefined && (
                    <div className="flex flex-col gap-2 p-2">
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                    </div>
                  )}

                  {agents && agents.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-white/50">
                      {t('agent.noAgents')}
                    </div>
                  )}

                  {agents?.map((agent) => (
                    <AgentSection
                      key={agent.id}
                      agent={agent}
                      conversations={(conversations ?? []).filter(
                        (c) => c.agentId === agent.id
                      )}
                      generateTitleConvId={generateTitleConvId}
                      onNewChat={() => onClickAgent(agent)}
                      onEdit={() => setEditingAgent(agent)}
                      onDelete={() => onClickDeleteAgent(agent)}
                      updateTitle={props.updateConversationTitle}
                      onDeleteConversation={props.onDeleteConversation}
                      onClickConversation={closeSmallDrawer}
                    />
                  ))}

                  {agents && agents.length > 0 && (
                    <Button
                      text
                      rightIcon={<PiArrowRight />}
                      className="w-full"
                      onClick={() => {
                        navigate('/conversations?tab=agents');
                        closeSmallDrawer();
                      }}>
                      {t('button.allChatsAndAgents')}
                    </Button>
                  )}
                </div>
              )}

              {drawerTab === 'chats' &&
                drawerOptions.show.conversationHistory && (
                <ExpandableDrawerGroup
                  label={t('app.conversationHistory')}
                  className={twMerge(
                    'border-t bg-aws-squid-ink-light pt-1 dark:bg-aws-squid-ink-dark',
                    props.isAdmin ? 'mb-20' : 'mb-10'
                  )}>
                  {conversations === undefined && (
                    <div className="flex flex-col gap-2 p-2">
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                      <Skeleton className="h-10 w-full bg-aws-sea-blue-light/50 dark:bg-aws-sea-blue-dark/50" />
                    </div>
                  )}
                  {conversations && (
                    <div className="flex items-center justify-between px-2 py-1 text-xs text-white/70">
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="flex items-center gap-2 rounded p-1 hover:bg-white/5">
                        <PiFolderPlus className="text-base" />
                        {t('folder.newFolder')}
                      </button>
                      {conversations.length > 0 && (
                        <button
                          type="button"
                          onClick={props.onClearConversations}
                          className="flex items-center gap-1 rounded p-1 hover:bg-white/5">
                          <PiTrash className="text-base" />
                          {t('folder.clearAll')}
                        </button>
                      )}
                    </div>
                  )}

                  {(folders ?? []).map((folder) => {
                    const items = (conversations ?? []).filter(
                      (c) => c.folderId === folder.id && !c.agentId
                    );
                    return (
                      <FolderSection
                        key={folder.id}
                        folder={folder}
                        onRename={() => handleRenameFolder(folder)}
                        onDelete={() => handleDeleteFolder(folder)}
                        onNewChat={() => {
                          newChat(folder.id);
                          navigate('/');
                          closeSmallDrawer();
                        }}
                        onDropConversation={(conversationId) =>
                          onMoveConversation(conversationId, folder.id)
                        }>
                        {items.length === 0 && (
                          <div className="px-3 py-1 text-xs text-white/50">
                            {t('folder.dropHint')}
                          </div>
                        )}
                        {items.map((conversation) => (
                          <Item
                            key={conversation.id}
                            className="grow"
                            label={conversation.title}
                            conversationId={conversation.id}
                            generatedTitle={
                              conversation.id === generateTitleConvId
                            }
                            draggable
                            onDragStart={handleDragStart(conversation.id)}
                            updateTitle={props.updateConversationTitle}
                            onClick={closeSmallDrawer}
                            onDelete={() =>
                              props.onDeleteConversation(conversation)
                            }
                          />
                        ))}
                      </FolderSection>
                    );
                  })}

                  <div
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(CONV_DND_TYPE)) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setIsUnfiledOver(true);
                      }
                    }}
                    onDragLeave={() => setIsUnfiledOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsUnfiledOver(false);
                      const id = e.dataTransfer.getData(CONV_DND_TYPE);
                      if (id) {
                        onMoveConversation(id, null);
                      }
                    }}
                    className={twMerge(
                      'min-h-[1rem] rounded',
                      isUnfiledOver &&
                        'bg-aws-sea-blue-dark/40 ring-1 ring-inset ring-white/30'
                    )}>
                    {(folders ?? []).length > 0 && (
                      <div className="px-2 pt-1 text-xs text-white/50">
                        {t('folder.unfiled')}
                      </div>
                    )}
                    {conversations
                      ?.filter((c) => !c.folderId && !c.agentId)
                      .slice(0, drawerOptions.displayCount.conversationHistory)
                      .map((conversation) => (
                        <Item
                          key={conversation.id}
                          className="grow"
                          label={conversation.title}
                          conversationId={conversation.id}
                          generatedTitle={
                            conversation.id === generateTitleConvId
                          }
                          draggable
                          onDragStart={handleDragStart(conversation.id)}
                          updateTitle={props.updateConversationTitle}
                          onClick={closeSmallDrawer}
                          onDelete={() =>
                            props.onDeleteConversation(conversation)
                          }
                        />
                      ))}
                  </div>

                  {conversations && (
                    <Button
                      text
                      rightIcon={<PiArrowRight />}
                      className="w-full"
                      onClick={() => {
                        navigate('/conversations');
                        closeSmallDrawer();
                      }}>
                      {t('button.allChatsAndAgents')}
                    </Button>
                  )}
                </ExpandableDrawerGroup>
              )}
            </>
          )}

          {isAdminPanel && (
            <>
              <div className="px-2 py-1 italic">{t('app.adminConsoles')}</div>
              <DrawerItem
                className="w-60"
                isActive={location.pathname === '/admin/shared-bot-analytics'}
                icon={<PiChartLine />}
                to="/admin/shared-bot-analytics"
                labelComponent={getPageLabel('/admin/shared-bot-analytics')}
                onClick={closeSmallDrawer}
              />
              <DrawerItem
                className="w-60"
                isActive={location.pathname === '/admin/api-management'}
                icon={<PiPlugs />}
                to="/admin/api-management"
                labelComponent={getPageLabel('/admin/api-management')}
                onClick={closeSmallDrawer}
              />
            </>
          )}

          <div
            className={twMerge(
              opened ? 'w-64' : 'w-0',
              props.isAdmin ? 'h-20' : 'h-10',
              'fixed -bottom-2 z-50 mb-2 flex flex-col items-start border-t bg-aws-squid-ink-light transition-width dark:bg-aws-ui-color-dark lg:w-[var(--drawer-width)]'
            )}>
            {props.isAdmin && !isAdminPanel && (
              <DrawerItem
                className="w-60"
                isActive={false}
                icon={<PiPresentationChart />}
                to="/admin/shared-bot-analytics"
                labelComponent={t('app.adminConsoles')}
                onClick={closeSmallDrawer}
              />
            )}
            {isAdminPanel && (
              <DrawerItem
                className="w-60"
                isActive={false}
                icon={<PiChatCenteredDotsDuotone />}
                to="/"
                labelComponent={t('app.backChat')}
                onClick={closeSmallDrawer}
              />
            )}
            <Menu
              className="mx-2 flex h-10 w-60 justify-start"
              onSignOut={props.onSignOut}
              onSelectLanguage={props.onSelectLanguage}
              onClearConversations={props.onClearConversations}
              onClickDrawerOptions={props.onClickDrawerOptions}
            />
          </div>
        </nav>
      </div>

      {/* Desktop-only drag handle to resize the drawer so long chat titles are
          readable. Hidden on mobile, where the drawer is a slide-over. */}
      <div
        onMouseDown={startResize}
        role="separator"
        aria-orientation="vertical"
        style={{ left: drawerWidth - 3 }}
        className="fixed top-0 z-30 hidden h-full w-1.5 cursor-col-resize hover:bg-white/30 lg:block"
      />

      <div
        ref={smallDrawer}
        className={`lg:hidden ${opened ? 'visible' : 'hidden'}`}>
        <ButtonIcon
          className="fixed left-64 top-0 z-50 text-white"
          onClick={switchOpen}>
          <PiX />
        </ButtonIcon>
        <div
          className="fixed z-40 h-dvh w-screen bg-dark-gray/90"
          onClick={switchOpen}></div>
      </div>
    </>
  );
};

export default Drawer;
