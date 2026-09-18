import {
  DocumentFolderCreateRequest,
  DocumentModifyRequest,
} from '../@types/workspaceDocument';
import useWorkspaceDocumentApi from './useWorkspaceDocumentApi';

const useWorkspaceDocument = () => {
  const api = useWorkspaceDocumentApi();

  const {
    data: documents,
    mutate: mutateDocuments,
    isLoading: isLoadingDocuments,
  } = api.documents();

  const {
    data: folders,
    mutate: mutateFolders,
    isLoading: isLoadingFolders,
  } = api.folders();

  return {
    documents,
    folders,
    isLoadingDocuments,
    isLoadingFolders,
    mutateDocuments,
    mutateFolders,

    // Upload a raw file: presigned PUT to S3, then persist metadata.
    uploadDocument: async (file: File, folderId?: string | null) => {
      const { data: presigned } = await api.getPresignedUrl({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      });
      // Direct PUT to S3 (bypasses the app's auth interceptor).
      const putRes = await fetch(presigned.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed with status ${putRes.status}`);
      }
      await api.createDocument({
        docId: presigned.docId,
        filename: file.name,
        s3Key: presigned.s3Key,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        folderId: folderId ?? null,
      });
      await mutateDocuments();
    },

    updateDocument: async (docId: string, params: DocumentModifyRequest) => {
      const res = await api.updateDocument(docId, params);
      await mutateDocuments();
      return res.data;
    },

    deleteDocument: async (docId: string) => {
      await api.deleteDocument(docId);
      await mutateDocuments();
    },

    moveDocumentToFolder: async (docId: string, folderId: string | null) => {
      await api.updateDocument(docId, { folderId });
      await mutateDocuments();
    },

    createFolder: async (params: DocumentFolderCreateRequest) => {
      const res = await api.createFolder(params);
      await mutateFolders();
      return res.data;
    },

    renameFolder: async (folderId: string, name: string) => {
      await api.updateFolder(folderId, { name });
      await mutateFolders();
    },

    deleteFolder: async (folderId: string) => {
      await api.deleteFolder(folderId);
      // Documents in the folder fall back to root — refresh both.
      await Promise.all([mutateFolders(), mutateDocuments()]);
    },
  };
};

export default useWorkspaceDocument;
