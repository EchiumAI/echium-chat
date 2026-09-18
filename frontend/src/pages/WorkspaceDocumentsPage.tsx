import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiFolder,
  PiFolderPlus,
  PiFile,
  PiPencilLine,
  PiShareNetwork,
  PiTrash,
  PiUploadSimple,
} from 'react-icons/pi';
import { WorkspaceDocument } from '../@types/workspaceDocument';
import useWorkspaceDocument from '../hooks/useWorkspaceDocument';
import ListPageLayout from '../layouts/ListPageLayout';
import Button from '../components/Button';
import ButtonIcon from '../components/ButtonIcon';
import ModalDialog from '../components/ModalDialog';
import DialogShareDocument from '../components/DialogShareDocument';

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
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    createFolder,
    renameFolder,
    deleteFolder,
  } = useWorkspaceDocument();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [shareTarget, setShareTarget] = useState<WorkspaceDocument>();
  const [moveTarget, setMoveTarget] = useState<WorkspaceDocument>();

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
      className="group flex items-center justify-between border-b border-gray p-2 hover:bg-light-gray dark:hover:bg-aws-ui-color-dark">
      <div className="flex min-w-0 items-center gap-2">
        <PiFile className="shrink-0 text-aws-sea-blue-light" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{doc.filename}</span>
          <span className="text-xs text-gray">
            {shareSummary(doc)}
            {formatSize(doc.size) ? ` · ${formatSize(doc.size)}` : ''}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
        <ButtonIcon onClick={() => setShareTarget(doc)}>
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
        <div className="flex max-h-80 w-[85vw] max-w-sm flex-col gap-1 overflow-y-auto">
          {(folders ?? []).length === 0 && (
            <div className="p-2 text-xs text-gray">
              {t('document.noFolders')}
            </div>
          )}
          {(folders ?? []).map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="flex items-center gap-2 rounded p-2 text-left hover:bg-light-gray dark:hover:bg-aws-ui-color-dark"
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
              className="mt-1 flex items-center gap-2 rounded border-t border-gray p-2 text-left hover:bg-light-gray dark:hover:bg-aws-ui-color-dark"
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
          <div className="flex flex-wrap justify-end gap-2">
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
        <div className="flex flex-col gap-4 pt-3">
          {(folders ?? []).map((folder) => {
            const items = docsByFolder.get(folder.id) ?? [];
            return (
              <div
                key={folder.id}
                className="overflow-hidden rounded-lg border border-gray">
                <div className="flex items-center justify-between gap-1 bg-light-gray px-2 py-1.5 dark:bg-aws-ui-color-dark">
                  <div className="flex min-w-0 items-center gap-2 font-medium">
                    <PiFolder className="shrink-0 text-aws-sea-blue-light" />
                    <span className="truncate">{folder.name}</span>
                    <span className="shrink-0 text-xs text-gray">
                      ({items.length})
                    </span>
                  </div>
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
                {items.length === 0 ? (
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
      </ListPageLayout>
    </>
  );
};

export default WorkspaceDocumentsPage;
