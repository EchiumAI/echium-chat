import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiArrowSquareOut,
  PiCaretDown,
  PiCaretRight,
  PiChatCircleText,
  PiDownloadSimple,
  PiFolder,
  PiFolderPlus,
  PiFile,
  PiFileText,
  PiMagnifyingGlass,
  PiPencilLine,
  PiPenNib,
  PiShareNetwork,
  PiStar,
  PiStarFill,
  PiTrash,
  PiUploadSimple,
  PiX,
} from 'react-icons/pi';
import { WorkspaceDocument } from '../@types/workspaceDocument';
import useWorkspaceDocument from '../hooks/useWorkspaceDocument';
import ListPageLayout from '../layouts/ListPageLayout';
import Button from '../components/Button';
import ButtonIcon from '../components/ButtonIcon';
import InputText from '../components/InputText';
import ModalDialog from '../components/ModalDialog';
import DialogShareDocument from '../components/DialogShareDocument';
import useGlobalConfig from '../hooks/useGlobalConfig';

const formatSize = (bytes: number): string => {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const WorkspaceDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    documents,
    folders,
    isLoadingDocuments,
    isLoadingFolders,
    uploadDocument,
    updateDocument,
    deleteDocument,
    moveDocumentToFolder,
    setFavorite,
    getDocumentContent,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useWorkspaceDocument();

  const { getGlobalConfig } = useGlobalConfig();
  const { data: globalConfig } = getGlobalConfig();
  const docsAppUrl = globalConfig?.docsAppUrl ?? '';
  const drawAppUrl = globalConfig?.drawAppUrl ?? '';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [shareTarget, setShareTarget] = useState<WorkspaceDocument>();
  const [moveTarget, setMoveTarget] = useState<WorkspaceDocument>();

  // What kind of thing a document is decides where "Open" takes you:
  // Draw boards -> Echium Draw, text documents -> Echium Docs, everything
  // else (pdf/images/office files) -> download the original.
  type OpenTarget = 'draw' | 'docs' | 'download';
  const openTargetOf = useCallback((doc: WorkspaceDocument): OpenTarget => {
    const name = doc.filename.toLowerCase();
    if (name.endsWith('.excalidraw')) {
      return 'draw';
    }
    const ctype = (doc.contentType || '').toLowerCase();
    const textLike =
      ctype.startsWith('text/') ||
      /\.(md|markdown|txt|html?)$/.test(name) ||
      doc.source === 'agent' ||
      doc.source === 'chat_summary' ||
      // Created in Docs: no raw file, body is the document.
      (!ctype && !/\.[a-z0-9]{2,5}$/.test(name));
    return textLike ? 'docs' : 'download';
  }, []);

  const onOpenDoc = useCallback(
    async (doc: WorkspaceDocument) => {
      const target = openTargetOf(doc);
      // Reuse a single tab per app: the stable window name navigates an already
      // open tab to this document, otherwise opens one. `noopener` is omitted
      // deliberately — it forces a fresh tab each time and would defeat reuse;
      // the apps are first-party (shared Cognito pool). Encode the segments —
      // the workspace id contains '#' (WS#…) which would otherwise be parsed as
      // a URL fragment and break the path.
      const ws = encodeURIComponent(doc.workspaceId);
      const id = encodeURIComponent(doc.id);
      if (target === 'draw' && drawAppUrl) {
        window.open(
          `${drawAppUrl.replace(/\/$/, '')}/w/${ws}/b/${id}`,
          'echium-draw'
        );
        return;
      }
      if (target === 'docs' && docsAppUrl) {
        window.open(
          `${docsAppUrl.replace(/\/$/, '')}/w/${ws}/d/${id}`,
          'echium-docs'
        );
        return;
      }
      // Binary (or an app URL isn't configured): hand over the original file.
      try {
        const content = await getDocumentContent(doc.id);
        if (content.downloadUrl) {
          window.open(content.downloadUrl, '_blank', 'noopener');
        }
      } catch (e) {
        console.error('Could not open document', e);
      }
    },
    [openTargetOf, drawAppUrl, docsAppUrl, getDocumentContent]
  );

  const onFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          await uploadDocument(file).catch((e) => {
            console.error('Upload failed:', file.name, e);
          });
        }
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [uploadDocument]
  );

  const onNewFolder = useCallback(() => {
    const name = window.prompt(t('document.namePrompt') ?? '');
    if (name && name.trim()) {
      createFolder({ name: name.trim() }).catch(() => {});
    }
  }, [createFolder, t]);

  const onRenameFolder = useCallback(
    (folderId: string, current: string) => {
      const name = window.prompt(t('document.namePrompt') ?? '', current);
      if (name && name.trim() && name.trim() !== current) {
        renameFolder(folderId, name.trim()).catch(() => {});
      }
    },
    [renameFolder, t]
  );

  const onDeleteFolder = useCallback(
    (folderId: string, name: string) => {
      if (window.confirm(t('document.folderDeleteConfirm', { name }))) {
        deleteFolder(folderId).catch(() => {});
      }
    },
    [deleteFolder, t]
  );

  const onRenameDoc = useCallback(
    (doc: WorkspaceDocument) => {
      const name = window.prompt(t('document.namePrompt') ?? '', doc.filename);
      if (name && name.trim() && name.trim() !== doc.filename) {
        updateDocument(doc.id, { filename: name.trim() }).catch(() => {});
      }
    },
    [updateDocument, t]
  );

  const onDeleteDoc = useCallback(
    (doc: WorkspaceDocument) => {
      if (window.confirm(t('document.deleteConfirm', { name: doc.filename }))) {
        deleteDocument(doc.id).catch(() => {});
      }
    },
    [deleteDocument, t]
  );

  const onShareSave = useCallback(
    (allowedAgentIds: string[], allAgents: boolean) => {
      if (shareTarget) {
        updateDocument(shareTarget.id, { allowedAgentIds, allAgents }).catch(
          () => {}
        );
      }
      setShareTarget(undefined);
    },
    [shareTarget, updateDocument]
  );

  const isShared = (doc: WorkspaceDocument) =>
    doc.allAgents || doc.allowedAgentIds.length > 0;

  // Collapsed folders, remembered per browser. System folders (the auto-
  // generated "Chat summaries") start collapsed so they don't crowd the list.
  const COLLAPSE_KEY = 'echium.files.collapsedFolders';
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}');
    } catch {
      return {};
    }
  });
  const isCollapsed = useCallback(
    (folderId: string, isSystem: boolean) =>
      collapsed[folderId] ?? isSystem,
    [collapsed]
  );
  const toggleCollapsed = useCallback(
    (folderId: string, isSystem: boolean) => {
      setCollapsed((prev) => {
        const next = { ...prev, [folderId]: !(prev[folderId] ?? isSystem) };
        try {
          localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
        } catch {
          // Storage full/unavailable: the toggle still works for this session.
        }
        return next;
      });
    },
    []
  );

  // Filename search. While a query is active the folder tree is replaced by a
  // flat result list (same behaviour as the Docs ⌘K search).
  const [query, setQuery] = useState('');
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return null;
    }
    const folderName = new Map((folders ?? []).map((f) => [f.id, f.name]));
    return (documents ?? [])
      .filter((d) => {
        const inName = d.filename.toLowerCase().includes(q);
        const inFolder = d.folderId
          ? (folderName.get(d.folderId) ?? '').toLowerCase().includes(q)
          : false;
        return inName || inFolder;
      })
      .sort((a, b) => b.updateTime - a.updateTime);
  }, [query, documents, folders]);

  const favoriteDocs = useMemo(
    () =>
      (documents ?? [])
        .filter((d) => d.isFavorite)
        .sort((a, b) => b.updateTime - a.updateTime),
    [documents]
  );

  // Storage consumed by the workspace: sum of stored sizes across all files.
  const storageSummary = useMemo(() => {
    const docs = documents ?? [];
    const bytes = docs.reduce((acc, d) => acc + (d.size || 0), 0);
    const size = formatSize(bytes) || '0 B';
    return docs.length === 1
      ? t('document.storageOne', { size })
      : t('document.storage', { count: docs.length, size });
  }, [documents, t]);

  const shareSummary = useCallback(
    (doc: WorkspaceDocument): string => {
      if (doc.allAgents) {
        return t('document.share.allAgents');
      }
      if (doc.allowedAgentIds.length > 0) {
        return t('document.share.count', { count: doc.allowedAgentIds.length });
      }
      return t('document.share.private');
    },
    [t]
  );

  const docsByFolder = useMemo(() => {
    const map = new Map<string | null, WorkspaceDocument[]>();
    (documents ?? []).forEach((d) => {
      const key = d.folderId ?? null;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    });
    return map;
  }, [documents]);

  const renderDoc = (doc: WorkspaceDocument) => (
    <div
      key={doc.id}
      className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10">
      <div className="flex min-w-0 items-center gap-2">
        {doc.source === 'chat_summary' ? (
          <PiChatCircleText className="shrink-0 text-aws-aqua" />
        ) : openTargetOf(doc) === 'draw' ? (
          <PiPenNib className="shrink-0 text-aws-sea-blue-light" />
        ) : openTargetOf(doc) === 'download' ? (
          <PiFile className="shrink-0 text-gray" />
        ) : (
          <PiFileText className="shrink-0 text-aws-sea-blue-light" />
        )}
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDoc(doc)}
              className="truncate text-left text-sm font-medium hover:underline"
              title={t(`document.open.${openTargetOf(doc)}`)}>
              {doc.filename}
            </button>
            {doc.source === 'chat_summary' && (
              <span className="shrink-0 rounded-full bg-aws-aqua/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aws-aqua">
                {t('document.badge.summary')}
              </span>
            )}
          </div>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray">
            {/* Sharing state as a visible badge: green when agents can use the
                file, amber when it's still private — so users see at a glance
                why an agent "can't find" a file. */}
            <button
              type="button"
              onClick={() => setShareTarget(doc)}
              title={
                isShared(doc)
                  ? shareSummary(doc)
                  : t('document.share.privateHint')
              }
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isShared(doc)
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}>
              {shareSummary(doc)}
            </button>
            {formatSize(doc.size) ? (
              <span className="truncate">{formatSize(doc.size)}</span>
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* Primary action is always visible (not hover-only): sharing is how a
            file becomes usable by an agent, and it was too easy to miss. */}
        <button
          type="button"
          onClick={() => setShareTarget(doc)}
          className="hidden items-center gap-1 rounded-lg border border-aws-sea-blue-light/40 px-2 py-1 text-xs font-medium text-aws-sea-blue-light hover:bg-aws-sea-blue-light/10 sm:flex dark:border-aws-sea-blue-dark/60 dark:text-aws-sea-blue-dark">
          <PiShareNetwork />
          {t('document.share.button')}
        </button>
        <ButtonIcon
          className={doc.isFavorite ? 'text-amber-500' : ''}
          onClick={() =>
            setFavorite(doc.id, !doc.isFavorite).catch(() => {})
          }>
          {doc.isFavorite ? <PiStarFill /> : <PiStar />}
        </ButtonIcon>
        <div className="flex items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
          <ButtonIcon onClick={() => onOpenDoc(doc)}>
            {openTargetOf(doc) === 'download' ? (
              <PiDownloadSimple />
            ) : (
              <PiArrowSquareOut />
            )}
          </ButtonIcon>
          <ButtonIcon
            className="sm:hidden"
            onClick={() => setShareTarget(doc)}>
            <PiShareNetwork />
          </ButtonIcon>
          <ButtonIcon onClick={() => setMoveTarget(doc)}>
          <PiFolder />
        </ButtonIcon>
        <ButtonIcon onClick={() => onRenameDoc(doc)}>
          <PiPencilLine />
        </ButtonIcon>
        <ButtonIcon onClick={() => onDeleteDoc(doc)}>
          <PiTrash />
        </ButtonIcon>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <DialogShareDocument
        isOpen={!!shareTarget}
        document={shareTarget}
        onClose={() => setShareTarget(undefined)}
        onSave={onShareSave}
      />

      <ModalDialog
        isOpen={!!moveTarget}
        title={t('document.moveTo')}
        showCloseIcon
        onClose={() => setMoveTarget(undefined)}>
        <div className="flex max-h-80 w-full flex-col gap-1 overflow-y-auto">
          {(folders ?? []).length === 0 && (
            <div className="p-2 text-xs text-gray">
              {t('document.noFolders')}
            </div>
          )}
          {(folders ?? []).map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => {
                if (moveTarget) {
                  moveDocumentToFolder(moveTarget.id, folder.id).catch(() => {});
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
              className="mt-1 flex items-center gap-2 rounded-lg border-t border-black/5 p-2 text-left hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              onClick={() => {
                if (moveTarget) {
                  moveDocumentToFolder(moveTarget.id, null).catch(() => {});
                }
                setMoveTarget(undefined);
              }}>
              {t('document.removeFromFolder')}
            </button>
          )}
        </div>
      </ModalDialog>

      <ListPageLayout
        pageTitle={t('document.pageTitle')}
        pageTitleActions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className="mr-1 rounded-full bg-black/5 px-3 py-1 text-xs text-gray dark:bg-white/10"
              title={storageSummary}>
              {storageSummary}
            </span>
            <Button
              className="text-sm"
              outlined
              icon={<PiFolderPlus />}
              onClick={onNewFolder}>
              {t('document.newFolder')}
            </Button>
            <Button
              className="text-sm"
              icon={<PiUploadSimple />}
              loading={isUploading}
              onClick={() => fileInputRef.current?.click()}>
              {t('document.upload')}
            </Button>
          </div>
        }
        isLoading={isLoadingDocuments || isLoadingFolders}
        isEmpty={
          (documents?.length ?? 0) === 0 && (folders?.length ?? 0) === 0
        }
        emptyMessage={t('document.empty')}>
        <div className="relative mt-3">
          <InputText
            icon={<PiMagnifyingGlass />}
            placeholder={t('document.searchPlaceholder')}
            value={query}
            onChange={setQuery}
          />
          {query && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark-gray"
              onClick={() => setQuery('')}
              aria-label="Clear search">
              <PiX size={20} />
            </button>
          )}
        </div>

        {searchResults ? (
          <div className="flex flex-col gap-2 pt-3">
            <div className="text-xs text-gray">
              {searchResults.length === 0
                ? t('document.searchNoResults', { query: query.trim() })
                : t('document.searchResults', { count: searchResults.length })}
            </div>
            {searchResults.length > 0 && (
              <div className="rounded-lg border border-gray">
                {searchResults.map(renderDoc)}
              </div>
            )}
          </div>
        ) : (
        <div className="flex flex-col gap-4 pt-3">
          {favoriteDocs.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <PiStarFill className="text-amber-500" />
                {t('document.favorites')}
                <span className="text-xs text-gray">
                  ({favoriteDocs.length})
                </span>
              </div>
              <div className="rounded-lg border border-gray">
                {favoriteDocs.map(renderDoc)}
              </div>
            </div>
          )}

          {(folders ?? []).map((folder) => {
            const items = docsByFolder.get(folder.id) ?? [];
            const folded = isCollapsed(folder.id, folder.isSystem);
            return (
              <div
                key={folder.id}
                className="overflow-hidden rounded-lg border border-gray">
                <div className="flex items-center justify-between gap-1 bg-light-gray px-2 py-1.5 dark:bg-aws-ui-color-dark">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(folder.id, folder.isSystem)}
                    aria-expanded={!folded}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium">
                    {folded ? (
                      <PiCaretRight className="shrink-0 text-gray" />
                    ) : (
                      <PiCaretDown className="shrink-0 text-gray" />
                    )}
                    {folder.isSystem ? (
                      <PiChatCircleText className="shrink-0 text-aws-aqua" />
                    ) : (
                      <PiFolder className="shrink-0 text-aws-sea-blue-light" />
                    )}
                    <span className="truncate">{folder.name}</span>
                    <span className="shrink-0 text-xs text-gray">
                      ({items.length})
                    </span>
                  </button>
                  {!folder.isSystem && (
                    <div className="flex shrink-0 gap-1">
                      <ButtonIcon
                        onClick={() => onRenameFolder(folder.id, folder.name)}>
                        <PiPencilLine />
                      </ButtonIcon>
                      <ButtonIcon
                        onClick={() => onDeleteFolder(folder.id, folder.name)}>
                        <PiTrash />
                      </ButtonIcon>
                    </div>
                  )}
                </div>
                {folded ? null : items.length === 0 ? (
                  <div className="p-3 text-xs text-gray">
                    {t('document.folderEmpty')}
                  </div>
                ) : (
                  items.map(renderDoc)
                )}
              </div>
            );
          })}

          {/* Root (unfiled) documents */}
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              {t('document.root')}
              <span className="text-xs text-gray">
                ({(docsByFolder.get(null) ?? []).length})
              </span>
            </div>
            <div className="rounded-lg border border-gray">
              {(docsByFolder.get(null) ?? []).length === 0 ? (
                <div className="p-3 text-xs text-gray">
                  {t('document.folderEmpty')}
                </div>
              ) : (
                (docsByFolder.get(null) ?? []).map(renderDoc)
              )}
            </div>
          </div>
        </div>
        )}
      </ListPageLayout>
    </>
  );
};

export default WorkspaceDocumentsPage;
