// Workspace document store: files uploaded manually or captured from chats,
// organized in folders, and shared with specific agents. Backend keeps the
// raw file in S3 and the metadata on the conversation table (no OpenSearch).

export type WorkspaceDocument = {
  id: string;
  workspaceId: string;
  filename: string;
  contentType: string;
  size: number;
  source: 'chat' | 'agent' | 'manual' | 'chat_summary';
  folderId: string | null;
  allowedAgentIds: string[];
  allAgents: boolean;
  isSystem: boolean;
  createTime: number;
  updateTime: number;
};

export type DocumentFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  isSystem: boolean;
  createTime: number;
};

export type PresignedUploadResponse = {
  docId: string;
  url: string;
  s3Key: string;
};

export type PresignedUploadRequest = {
  filename: string;
  contentType?: string;
};

export type DocumentCreateRequest = {
  docId: string;
  filename: string;
  s3Key: string;
  contentType?: string;
  size: number;
  extractedText?: string;
  folderId?: string | null;
};

export type DocumentModifyRequest = {
  filename?: string;
  folderId?: string | null;
  allowedAgentIds?: string[];
  allAgents?: boolean;
};

export type DocumentFolderCreateRequest = {
  name: string;
  parentFolderId?: string | null;
};

export type DocumentFolderModifyRequest = {
  name: string;
};
