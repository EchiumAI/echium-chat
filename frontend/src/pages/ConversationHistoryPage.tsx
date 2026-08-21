import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCheck,
  PiFolder,
  PiFolderPlus,
  PiMagnifyingGlass,
  PiPencilLine,
  PiPlus,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import useConversation from '../hooks/useConversation';
import useConversationSearch from '../hooks/useConversationSearch';
import { ConversationFolder, ConversationMeta } from '../@types/conversation';
import ButtonIcon from '../components/ButtonIcon';
import InputText from '../components/InputText';
import useChat from '../hooks/useChat';
import DialogConfirmDeleteChat from '../components/DialogConfirmDeleteChat';
import DialogConfirmClearConversations from '../components/DialogConfirmClearConversations';
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
  } = useConversation();

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
      draggable={editingConversationId !== conversation.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONV_DND_TYPE, conversation.id);
        e.dataTransfer.setData('text/plain', conversation.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="group flex cursor-pointer items-center justify-between border-b border-gray p-2 hover:bg-light-gray"
      onClick={() => onClickConversation(conversation.id)}>
      <div className="flex flex-col">
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
      {editingConversationId !== conversation.id && (
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
          <div className="flex gap-2">
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
              <Button
                className="text-sm"
                outlined
                icon={<PiTrash />}
                onClick={() => setIsOpenClearDialog(true)}>
                {t('folder.clearAll')}
              </Button>
            )}
          </div>
        }
        searchCondition={
          <div className="relative mb-2">
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
        }
        isLoading={isLoadingConversations && !hasSearched}
        isEmpty={conversations?.length === 0 && !hasSearched}
        emptyMessage={t('conversationHistory.label.noConversations')}>
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
                      (c) => c.folderId === folder.id
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
                            'flex items-center justify-between px-2 py-1.5',
                            color.bg
                          )}>
                          <div className="flex items-center gap-2 font-medium">
                            <PiFolder className={color.text} />
                            <span>{folder.name}</span>
                            <span className="text-xs text-gray">
                              ({items.length})
                            </span>
                          </div>
                          <div className="flex gap-1">
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
                  ({(conversations ?? []).filter((c) => !c.folderId).length})
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
                {conversations?.filter((c) => !c.folderId).map(renderRow)}
              </div>
            </div>
          </div>
        )}
      </ListPageLayout>
    </>
  );
};

export default ConversationHistoryPage;
