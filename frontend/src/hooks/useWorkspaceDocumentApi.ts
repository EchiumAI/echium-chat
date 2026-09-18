import {
  DocumentCreateRequest,
  DocumentFolder,
  DocumentFolderCreateRequest,
  DocumentFolderModifyRequest,
  DocumentModifyRequest,
  PresignedUploadRequest,
  PresignedUploadResponse,
  WorkspaceDocument,
} from '../@types/workspaceDocument';
import useHttp from './useHttp';

const BASE = 'workspaces/default';

const useWorkspaceDocumentApi = () => {
  const http = useHttp();

  return {
    documents: () => {
      return http.get<WorkspaceDocument[]>(`${BASE}/documents`);
    },
    folders: () => {
      return http.get<DocumentFolder[]>(`${BASE}/document-folders`);
    },
    getPresignedUrl: (params: PresignedUploadRequest) => {
      return http.post<PresignedUploadResponse, PresignedUploadRequest>(
        `${BASE}/documents/presigned-url`,
        params
      );
    },
    createDocument: (params: DocumentCreateRequest) => {
      return http.post<WorkspaceDocument, DocumentCreateRequest>(
        `${BASE}/documents`,
        params
      );
    },
    updateDocument: (docId: string, params: DocumentModifyRequest) => {
      return http.patch<WorkspaceDocument, DocumentModifyRequest>(
        `${BASE}/documents/${docId}`,
        params
      );
    },
    deleteDocument: (docId: string) => {
      return http.delete(`${BASE}/documents/${docId}`);
    },
    createFolder: (params: DocumentFolderCreateRequest) => {
      return http.post<DocumentFolder, DocumentFolderCreateRequest>(
        `${BASE}/document-folders`,
        params
      );
    },
    updateFolder: (folderId: string, params: DocumentFolderModifyRequest) => {
      return http.patch<DocumentFolder, DocumentFolderModifyRequest>(
        `${BASE}/document-folders/${folderId}`,
        params
      );
    },
    deleteFolder: (folderId: string) => {
      return http.delete(`${BASE}/document-folders/${folderId}`);
    },
  };
};

export default useWorkspaceDocumentApi;
