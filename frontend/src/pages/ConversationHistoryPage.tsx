import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCheck,
  PiChecks,
  PiChatCircleText,
  PiFolder,
  PiFolderPlus,
  PiMagnifyingGlass,
  PiPencilLine,
  PiPlus,
  PiRobot,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useConversation from '../hooks/useConversation';
import useConversationSearch from '../hooks/useConversationSearch';
import { ConversationFolder, ConversationMeta } from '../@types/conversation';
import { Agent } from '../@types/agent';
import ButtonIcon from '../components/ButtonIcon';
import InputText from '../components/InputText';
import useChat from '../hooks/useChat';
import useAgent from '../hooks/useAgent';
import DialogConfirmDeleteChat from '../components/DialogConfirmDeleteChat';
import DialogConfirmClearConversations from '../components/DialogConfirmClearConversations';
import DialogAgentWizard from '../components/DialogAgentWizard';
import ModalDialog from '../components/ModalDialog';
import Button from '../components/Button';
import ListPageLayout from '../layouts/ListPageLayout';
import ConversationSearchResults from '../components/ConversationSearchResults';

// Custom drag-and-drop MIME type for moving a conversation into a folder.
const CONV_DND_TYPE = 'application/x-echium-conversation-id';

// Accent colors cycled per folder (brand palette) to make folders easier to
// tell apart. Full class strings so Tailwind keeps them at build time.
const FOLDER_COLORS = [
  {
    borderL: 'border-l-aws-sea-blue-light',
    text: 'text-aws-sea-blue-light',
    bg: 'bg-aws-sea-blue-light/10',
  },
  { borderL: 'border-l-aws-aqua', text: 'text-aws-aqua', bg: 'bg-aws-aqua/10' },
  { borderL: 'border-l-aws-lab', text: 'text-aws-lab', bg: 'bg-aws-lab/10' },
  { borderL: 'border-l-aws-mist', text: 'text-aws-mist', bg: 'bg-aws-mist/20' },
];

const ConversationHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpenDeleteDialog, setIsOpenDeleteDialog] = useState(false);
  const [targetConversation, setTargetConversation] =
    useState<ConversationMeta>();
  const [editingConversationId, setEditingConversationId] = useState<
    string | null
  >(null);
  const [tempTitle, setTempTitle] = useState('');
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { setConversationId, newChat } = useChat();
  const {
    conversations,
    folders,
    deleteConversation,
    updateTitle,
    isLoadingConversations,
    createFolder,
    renameFolder,
    deleteFolder,
    moveConversationToFolder,
    clearConversations,
    deleteConversations,
  } = useConversation();

  // Multi-select mode for bulk-deleting chats.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isOpenBulkDeleteDialog, setIsOpenBulkDeleteDialog] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Folders | Agents tab. Agents are lightweight, workspace-scoped personas
  // created through the conversational wizard (see DialogAgentWizard).
  // The tab (and optional wizard auto-open) can be deep-linked from the
  // sidebar via ?tab=agents and ?new=1.
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'folders' | 'agents'>(
    searchParams.get('tab') === 'agents' ? 'agents' : 'folders'
  );
  const [isWizardOpen, setIsWizardOpen] = useState(
    searchParams.get('new') === '1'
  );
  const { agents, isLoadingAgents, deleteAgent } = useAgent();

  // Keep the active tab in sync when the query param changes while the page
  // is already mounted (e.g. clicking the sidebar Agents item again).
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'agents') {
      setActiveTab('agents');
    } else if (tab === 'folders') {
      setActiveTab('folders');
    }
    if (searchParams.get('new') === '1') {
      setActiveTab('agents');
      setIsWizardOpen(true);
    }
  }, [searchParams]);

  const onCreatedAgent = useCallback(
    (agent: Agent) => {
      setIsWizardOpen(false);
      // Start a fresh chat with the new agent.
      newChat();
      navigate(`/agent/${agent.id}`);
    },
    [navigate, newChat]
  );

  const onClickAgent = useCallback(
    (agent: Agent) => {
      newChat();
      navigate(`/agent/${agent.id}`);
    },
    [navigate, newChat]
  );

  const onClickDeleteAgent = useCallback(
    (e: React.MouseEvent, agent: Agent) => {
      e.stopPropagation();
      if (window.confirm(t('agent.deleteConfirm', { name: agent.name }))) {
        deleteAgent(agent.id).catch(() => {});
      }
    },
    [deleteAgent, t]
  );

  const allSelected =
    (conversations?.length ?? 0) > 0 &&
    selectedIds.size === (conversations?.length ?? 0);

  const onToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === (conversations?.length ?? 0)) {
        return new Set();
      }
      return new Set((conversations ?? []).map((c) => c.id));
    });
  }, [conversations]);

  const onBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      return;
    }
    setIsOpenBulkDeleteDialog(false);
    deleteConversations(ids).catch(() => {});
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [selectedIds, deleteConversations]);

  const [isOpenClearDialog, setIsOpenClearDialog] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<
    string | null | 'unfiled'
  >(null);
  // Conversation whose folder is being picked in the move dialog (tap/touch).
  const [moveTarget, setMoveTarget] = useState<ConversationMeta | undefined>();

  const handleCreateFolder = useCallback(() => {
    const name = window.prompt(t('folder.namePrompt') ?? '');
    if (name && name.trim()) {
      createFolder(name.trim());
    }
  }, [createFolder, t]);

  const handleRenameFolder = useCallback(
    (folder: ConversationFolder) => {
      const name = window.prompt(t('folder.namePrompt') ?? '', folder.name);
      if (name && name.trim() && name.trim() !== folder.name) {
        renameFolder(folder.id, name.trim());
      }
    },
    [renameFolder, t]
  );

  const handleDeleteFolder = useCallback(
    (folder: ConversationFolder) => {
      if (window.confirm(t('folder.deleteConfirm', { name: folder.name }))) {
        deleteFolder(folder.id);
      }
    },
    [deleteFolder, t]
  );

  const onClearConversations = useCallback(() => {
    clearConversations().then(() => {
      setIsOpenClearDialog(false);
      navigate('');
    });
  }, [clearConversations, navigate]);

  // Search hook
  const {
    searchResults,
    isSearching,
    hasSearched,
    displayQuery,
    handleSearch,
    clearSearch,
  } = useConversationSearch();

  // Input change handler
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      handleSearch(value);
    },
    [handleSearch]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setInputValue('');
    clearSearch();
  }, [clearSearch]);

  const onClickNewChat = useCallback(() => {
    newChat();
    navigate('/');
  }, [newChat, navigate]);

  const onClickDelete = useCallback(
    (e: React.MouseEvent, conversation: ConversationMeta) => {
      e.stopPropagation();
      setIsOpenDeleteDialog(true);
      setTargetConversation(conversation);
    },
    []
  );

  const onClickEdit = useCallback(
    (e: React.MouseEvent, conversation: ConversationMeta) => {
      e.stopPropagation();
      setEditingConversationId(conversation.id);
      setTempTitle(conversation.title);
    },
    []
  );

  const onDeleteConversation = useCallback(() => {
    if (targetConversation) {
      setIsOpenDeleteDialog(false);

      // Deletion process including optimistic update is handled in useConversation
      deleteConversation(targetConversation.id).catch(() => {
        setIsOpenDeleteDialog(true);
      });
    }
  }, [deleteConversation, targetConversation]);

  const onUpdateTitle = useCallback(
    (conversationId: string, title: string) => {
      // Exit edit mode
      setEditingConversationId(null);

      // Update process including optimistic update is handled in useConversation
      updateTitle(conversationId, title);
    },
    [updateTitle]
  );

  const onClickConversation = useCallback(
    (conversationId: string) => {
      if (editingConversationId !== conversationId) {
        setConversationId(conversationId);
        navigate(`/${conversationId}`);
      }
    },
    [navigate, setConversationId, editingConversationId]
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  useLayoutEffect(() => {
    if (editingConversationId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingConversationId]);

  useLayoutEffect(() => {
    if (editingConversationId && inputRef.current) {
      const listener = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onUpdateTitle(editingConversationId, tempTitle);
        } else if (e.key === 'Escape') {
          setEditingConversationId(null);
        }
      };

      const currentRef = inputRef.current;

      currentRef.addEventListener('keydown', listener);
      return () => {
        currentRef.removeEventListener('keydown', listener);
      };
    }
  }, [editingConversationId, tempTitle, onUpdateTitle]);

  const renderRow = (conversation: ConversationMeta) => (
    <div
      key={conversation.id}
      draggable={!selectionMode && editingConversationId !== conversation.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONV_DND_TYPE, conversation.id);
        e.dataTransfer.setData('text/plain', conversation.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={twMerge(
        'group flex cursor-pointer items-center justify-between border-b border-gray p-2 hover:bg-light-gray',
        selectionMode &&
          selectedIds.has(conversation.id) &&
          'bg-aws-sea-blue-light/10'
      )}
      onClick={() =>
        selectionMode
          ? toggleSelected(conversation.id)
          : onClickConversation(conversation.id)
      }>
      {selectionMode && (
        <input
          type="checkbox"
          className="mr-3 size-4 shrink-0 accent-aws-sea-blue-light"
          checked={selectedIds.has(conversation.id)}
          onChange={() => toggleSelected(conversation.id)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex flex-1 flex-col">
        {editingConversationId === conversation.id ? (
          <div
            className="flex items-center"
            onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              className="w-64 bg-transparent text-base"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
            />
            <ButtonIcon
              className="text-base"
              onClick={() => onUpdateTitle(conversation.id, tempTitle)}
              disabled={
                !tempTitle.trim() || tempTitle.trim() === conversation.title
              }>
              <PiCheck />
            </ButtonIcon>
            <ButtonIcon
              className="text-base"
              onClick={() => setEditingConversationId(null)}>
              <PiX />
            </ButtonIcon>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="text-base font-medium">{conversation.title}</div>
            <ButtonIcon
              className="-my-2 mr-6 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              onClick={(e) => onClickEdit(e, conversation)}>
              <PiPencilLine />
            </ButtonIcon>
          </div>
        )}
        <div className="text-xs text-gray">
          {formatDate(conversation.createTime)}
        </div>
      </div>
      {editingConversationId !== conversation.id && !selectionMode && (
        <div className="flex items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
          <ButtonIcon
            onClick={(e) => {
              e.stopPropagation();
              setMoveTarget(conversation);
            }}>
            <PiFolder />
          </ButtonIcon>
          <ButtonIcon onClick={(e) => onClickDelete(e, conversation)}>
            <PiTrash />
          </ButtonIcon>
        </div>
      )}
    </div>
  );

  return (
    <>
      <DialogConfirmDeleteChat
        isOpen={isOpenDeleteDialog}
        target={targetConversation}
        onDelete={onDeleteConversation}
        onClose={() => {
          setIsOpenDeleteDialog(false);
        }}
      />

      <DialogConfirmClearConversations
        isOpen={isOpenClearDialog}
        onDelete={onClearConversations}
        onClose={() => setIsOpenClearDialog(false)}
      />

      <DialogAgentWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCreated={onCreatedAgent}
      />

      <ModalDialog
        isOpen={isOpenBulkDeleteDialog}
        title={t('deleteDialog.title')}
        onClose={() => setIsOpenBulkDeleteDialog(false)}>
        <div className="text-sm">
          {t('conversationHistory.selection.deleteConfirm', {
            count: selectedIds.size,
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button outlined onClick={() => setIsOpenBulkDeleteDialog(false)}>
            {t('button.cancel')}
          </Button>
          <Button
            className="bg-red text-white hover:brightness-90"
            onClick={onBulkDelete}>
            {t('button.delete')}
          </Button>
        </div>
      </ModalDialog>

      <ModalDialog
        isOpen={!!moveTarget}
        title={t('folder.moveTo')}
        showCloseIcon
        onClose={() => setMoveTarget(undefined)}>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {(folders ?? []).length === 0 && (
            <div className="p-2 text-xs text-gray">{t('folder.noFolders')}</div>
          )}
          {(folders ?? []).map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={twMerge(
                'flex items-center gap-2 rounded p-2 text-left hover:bg-light-gray dark:hover:bg-aws-ui-color-dark',
                moveTarget?.folderId === folder.id && 'font-semibold'
              )}
              onClick={() => {
                if (moveTarget) {
                  moveConversationToFolder(moveTarget.id, folder.id);
                }
                setMoveTarget(undefined);
              }}>
              <PiFolder />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
          {moveTarget?.folderId && (
            <button
              type="button"
              className="mt-1 flex items-center gap-2 rounded border-t border-gray p-2 text-left hover:bg-light-gray dark:hover:bg-aws-ui-color-dark"
              onClick={() => {
                if (moveTarget) {
                  moveConversationToFolder(moveTarget.id, null);
                }
                setMoveTarget(undefined);
              }}>
              {t('folder.removeFromFolder')}
            </button>
          )}
        </div>
      </ModalDialog>

      <ListPageLayout
        pageTitle={t('conversationHistory.pageTitle')}
        pageTitleActions={
          activeTab === 'folders' ? (
            selectionMode ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-sm text-gray">
                  {t('conversationHistory.selection.selectedCount', {
                    count: selectedIds.size,
                  })}
                </span>
                <Button
                  className="text-sm"
                  outlined
                  icon={allSelected ? <PiX /> : <PiCheck />}
                  onClick={onToggleSelectAll}>
                  {allSelected
                    ? t('conversationHistory.selection.deselectAll')
                    : t('conversationHistory.selection.selectAll')}
                </Button>
                <Button
                  className="bg-red text-sm text-white hover:brightness-90"
                  icon={<PiTrash />}
                  disabled={selectedIds.size === 0}
                  onClick={() => setIsOpenBulkDeleteDialog(true)}>
                  {t('button.delete')}
                </Button>
                <Button
                  className="text-sm"
                  outlined
                  onClick={toggleSelectionMode}>
                  {t('button.cancel')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  className="text-sm"
                  outlined
                  icon={<PiFolderPlus />}
                  onClick={handleCreateFolder}>
                  {t('folder.newFolder')}
                </Button>
                <Button
                  className="text-sm"
                  outlined
                  icon={<PiPlus />}
                  onClick={onClickNewChat}>
                  {t('button.newChat')}
                </Button>
                {conversations && conversations.length > 0 && (
                  <>
                    <Button
                      className="text-sm"
                      outlined
                      icon={<PiChecks />}
                      onClick={toggleSelectionMode}>
                      {t('conversationHistory.selection.select')}
                    </Button>
                    <Button
                      className="text-sm"
                      outlined
                      icon={<PiTrash />}
                      onClick={() => setIsOpenClearDialog(true)}>
                      {t('folder.clearAll')}
                    </Button>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                className="text-sm"
                icon={<PiPlus />}
                onClick={() => setIsWizardOpen(true)}>
                {t('agent.new')}
              </Button>
            </div>
          )
        }
        searchCondition={
          <div>
            {/* Folders | Agents segmented control */}
            <div className="inline-flex rounded-lg border border-gray bg-light-gray p-0.5 dark:bg-aws-ui-color-dark">
              <button
                type="button"
                onClick={() => setActiveTab('folders')}
                className={twMerge(
                  'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  activeTab === 'folders'
                    ? 'bg-white text-aws-sea-blue-light shadow-sm dark:bg-aws-squid-ink-dark dark:text-aws-font-color-dark'
                    : 'text-gray hover:text-dark-gray dark:hover:text-light-gray'
                )}>
                <PiFolder />
                {t('folder.foldersLabel')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('agents')}
                className={twMerge(
                  'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  activeTab === 'agents'
                    ? 'bg-white text-aws-sea-blue-light shadow-sm dark:bg-aws-squid-ink-dark dark:text-aws-font-color-dark'
                    : 'text-gray hover:text-dark-gray dark:hover:text-light-gray'
                )}>
                <PiRobot />
                {t('agent.tab')}
              </button>
            </div>
            {activeTab === 'folders' && (
              <div className="relative my-2">
                <InputText
                  icon={<PiMagnifyingGlass />}
                  placeholder={t(
                    'conversationHistory.search.placeholder',
                    'Search conversations...'
                  )}
                  value={inputValue}
                  onChange={handleInputChange}
                />
                {inputValue && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark-gray"
                    onClick={handleClearSearch}>
                    <PiX size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
        }
        isLoading={
          activeTab === 'folders'
            ? isLoadingConversations && !hasSearched
            : isLoadingAgents
        }
        isEmpty={
          activeTab === 'folders'
            ? conversations?.length === 0 && !hasSearched
            : (agents?.length ?? 0) === 0
        }
        emptyMessage={
          activeTab === 'folders'
            ? t('conversationHistory.label.noConversations')
            : t('agent.noAgents')
        }>
        {/* Agents tab */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {(agents ?? []).map((agent) => (
              <div
                key={agent.id}
                onClick={() => onClickAgent(agent)}
                className="group flex cursor-pointer flex-col rounded-lg border border-gray p-3 hover:bg-light-gray dark:hover:bg-aws-ui-color-dark">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2 font-medium">
                    <PiRobot className="shrink-0 text-aws-sea-blue-light" />
                    <span className="truncate">{agent.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                    <ButtonIcon onClick={(e) => onClickDeleteAgent(e, agent)}>
                      <PiTrash />
                    </ButtonIcon>
                  </div>
                </div>
                {agent.description && (
                  <div className="mt-1 line-clamp-2 text-xs text-gray">
                    {agent.description}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1 text-xs text-aws-sea-blue-light dark:text-aws-font-color-dark">
                  <PiChatCircleText />
                  {t('agent.startChat')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Folders tab */}
        {activeTab === 'folders' && (
          <>
            {/* Search results */}
            <ConversationSearchResults
              results={searchResults}
              isSearching={isSearching}
              hasSearched={hasSearched}
              searchQuery={displayQuery}
              onbackToConversationHistory={handleClearSearch}
              onSelectConversation={onClickConversation}
            />

            {/* Regular conversation list, grouped by folder (hidden during search) */}
            {!hasSearched && (
          <div className="flex h-full min-h-0 flex-col gap-4 pt-3 lg:flex-row">
            {/* Folders pane — scrolls independently so it stays visible */}
            <div className="flex min-h-0 flex-col lg:w-2/5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-aws-font-color-light dark:text-aws-font-color-dark">
                <PiFolder />
                {t('folder.foldersLabel')}
              </div>
              <div className="max-h-[40vh] min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-aws-font-color-light/20 dark:scrollbar-thumb-aws-font-color-dark/20 lg:max-h-none">
                {(folders ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray p-4 text-center text-xs text-gray">
                    {t('folder.noFolders')}
                  </div>
                ) : (
                  (folders ?? []).map((folder, idx) => {
                    const color = FOLDER_COLORS[idx % FOLDER_COLORS.length];
                    const items = (conversations ?? []).filter(
                      (c) => c.folderId === folder.id && !c.agentId
                    );
                    const isOver = dragOverFolderId === folder.id;
                    return (
                      <div
                        key={folder.id}
                        onDragOver={(e) => {
                          if (e.dataTransfer.types.includes(CONV_DND_TYPE)) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverFolderId(folder.id);
                          }
                        }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverFolderId(null);
                          const id = e.dataTransfer.getData(CONV_DND_TYPE);
                          if (id) {
                            moveConversationToFolder(id, folder.id);
                          }
                        }}
                        className={twMerge(
                          'overflow-hidden rounded-lg border border-l-4 border-gray',
                          color.borderL,
                          isOver && 'ring-2 ring-aws-sea-blue-light'
                        )}>
                        <div
                          className={twMerge(
                            'flex items-center justify-between gap-1 px-2 py-1.5',
                            color.bg
                          )}>
                          <div className="flex min-w-0 items-center gap-2 font-medium">
                            <PiFolder
                              className={twMerge('shrink-0', color.text)}
                            />
                            <span className="truncate">{folder.name}</span>
                            <span className="shrink-0 text-xs text-gray">
                              ({items.length})
                            </span>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <ButtonIcon
                              onClick={() => {
                                newChat(folder.id);
                                navigate('/');
                              }}>
                              <PiPlus />
                            </ButtonIcon>
                            <ButtonIcon
                              onClick={() => handleRenameFolder(folder)}>
                              <PiPencilLine />
                            </ButtonIcon>
                            <ButtonIcon
                              onClick={() => handleDeleteFolder(folder)}>
                              <PiTrash />
                            </ButtonIcon>
                          </div>
                        </div>
                        {items.length === 0 ? (
                          <div className="p-3 text-xs text-gray">
                            {t('folder.dropHint')}
                          </div>
                        ) : (
                          items.map(renderRow)
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chats pane — the long list scrolls here, folders stay put */}
            <div className="flex min-h-0 flex-col lg:w-3/5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-aws-font-color-light dark:text-aws-font-color-dark">
                {t('folder.unfiled')}
                <span className="text-xs text-gray">
                  (
                  {
                    (conversations ?? []).filter(
                      (c) => !c.folderId && !c.agentId
                    ).length
                  }
                  )
                </span>
              </div>
              <div
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(CONV_DND_TYPE)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverFolderId('unfiled');
                  }
                }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(null);
                  const id = e.dataTransfer.getData(CONV_DND_TYPE);
                  if (id) {
                    moveConversationToFolder(id, null);
                  }
                }}
                className={twMerge(
                  'min-h-0 flex-1 overflow-y-auto rounded pr-1 scrollbar-thin scrollbar-thumb-aws-font-color-light/20 dark:scrollbar-thumb-aws-font-color-dark/20',
                  dragOverFolderId === 'unfiled' &&
                    'ring-2 ring-inset ring-aws-sea-blue-light'
                )}>
                {conversations
                  ?.filter((c) => !c.folderId && !c.agentId)
                  .map(renderRow)}
              </div>
            </div>
          </div>
            )}
          </>
        )}
      </ListPageLayout>
    </>
  );
};

export default ConversationHistoryPage;
