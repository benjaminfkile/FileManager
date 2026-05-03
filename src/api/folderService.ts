import apiClient from './apiClient';
import { IFolder, IFile, ISharedUser } from '../types';

export interface CreateFolderPayload {
  name: string;
  parentFolderId?: string;
}

export interface GetFolderResponse {
  folder: IFolder;
  subFolders: IFolder[];
  files: IFile[];
}

export interface ShareFolderResponse {
  sharedWith: ISharedUser;
}

export interface GetSharesResponse {
  sharedWith: ISharedUser[];
}

// GET /api/folders
export async function getRootFolders(): Promise<IFolder[]> {
  const { data } = await apiClient.get<{ folders: IFolder[] }>('/api/folders');
  return data.folders;
}

// POST /api/folders
export async function createFolder(payload: CreateFolderPayload): Promise<IFolder> {
  const { data } = await apiClient.post<{ data: IFolder }>('/api/folders', payload);
  return data.data;
}

// GET /api/folders/:id
export async function getFolder(id: string): Promise<GetFolderResponse> {
  const { data } = await apiClient.get<GetFolderResponse>(`/api/folders/${id}`);
  return data;
}

// PATCH /api/folders/:id
export async function renameFolder(id: string, name: string): Promise<IFolder> {
  const { data } = await apiClient.patch<{ data: IFolder }>(`/api/folders/${id}`, { name });
  return data.data;
}

// DELETE /api/folders/:id
export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/api/folders/${id}`);
}

// GET /api/folders/:id/download
export async function downloadFolder(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/api/folders/${id}/download`, {
    responseType: 'blob',
  });
  return data;
}

// POST /api/folders/:id/restore
export async function restoreFolder(id: string): Promise<IFolder> {
  const { data } = await apiClient.post<{ data: IFolder }>(`/api/folders/${id}/restore`);
  return data.data;
}

// DELETE /api/folders/:id/permanent
export async function permanentDeleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/api/folders/${id}/permanent`);
}

// POST /api/folders/:id/share
export async function shareFolder(id: string, username: string): Promise<ShareFolderResponse> {
  const { data } = await apiClient.post<ShareFolderResponse>(`/api/folders/${id}/share`, { username });
  return data;
}

// DELETE /api/folders/:id/share/:sharedUserId
export async function unshareFolder(id: string, sharedUserId: string): Promise<void> {
  await apiClient.delete(`/api/folders/${id}/share/${sharedUserId}`);
}

// GET /api/folders/:id/shares
export async function getFolderShares(id: string): Promise<GetSharesResponse> {
  const { data } = await apiClient.get<GetSharesResponse>(`/api/folders/${id}/shares`);
  return data;
}

// PATCH /api/folders/:id/move
export async function moveFolder(id: string, parentFolderId: string | null): Promise<IFolder> {
  const { data } = await apiClient.patch<{ folder: IFolder }>(`/api/folders/${id}/move`, { parentFolderId });
  return data.folder;
}

export interface PrepareFolderDownloadResponse {
  jobId: string;
  status: 'ready' | 'pending' | 'processing';
  url?: string;
  expiresAt?: string;
}

export interface FolderDownloadStatusResponse {
  status: 'ready' | 'pending' | 'processing' | 'failed';
  url?: string;
  expiresAt?: string;
  error?: string;
}

// POST /api/folders/:id/download/prepare
export async function prepareFolderDownload(id: string): Promise<PrepareFolderDownloadResponse> {
  const { data } = await apiClient.post<PrepareFolderDownloadResponse>(
    `/api/folders/${id}/download/prepare`
  );
  return data;
}

// GET /api/folders/:id/download/status/:jobId
export async function getFolderDownloadStatus(
  id: string,
  jobId: string
): Promise<FolderDownloadStatusResponse> {
  const { data } = await apiClient.get<FolderDownloadStatusResponse>(
    `/api/folders/${id}/download/status/${jobId}`
  );
  return data;
}
