import apiClient from './apiClient';
import { IShareLink, IShareLinkResolution } from '../types';

// POST /api/files/:id/link
export async function createFileShareLink(
  fileId: string,
  expiresInSeconds: number | null
): Promise<IShareLink> {
  const { data } = await apiClient.post<IShareLink>(`/api/files/${fileId}/link`, {
    expiresInSeconds,
  });
  return data;
}

// DELETE /api/files/:id/link
export async function revokeFileShareLink(fileId: string): Promise<void> {
  await apiClient.delete(`/api/files/${fileId}/link`);
}

// GET /api/files/:id/link
export async function getFileShareLink(fileId: string): Promise<IShareLink | null> {
  const { data } = await apiClient.get<{ shareLink: IShareLink | null }>(
    `/api/files/${fileId}/link`
  );
  return data.shareLink;
}

// POST /api/folders/:id/link
export async function createFolderShareLink(
  folderId: string,
  expiresInSeconds: number | null
): Promise<IShareLink> {
  const { data } = await apiClient.post<IShareLink>(`/api/folders/${folderId}/link`, {
    expiresInSeconds,
  });
  return data;
}

// DELETE /api/folders/:id/link
export async function revokeFolderShareLink(folderId: string): Promise<void> {
  await apiClient.delete(`/api/folders/${folderId}/link`);
}

// GET /api/folders/:id/link
export async function getFolderShareLink(folderId: string): Promise<IShareLink | null> {
  const { data } = await apiClient.get<{ shareLink: IShareLink | null }>(
    `/api/folders/${folderId}/link`
  );
  return data.shareLink;
}

// GET /api/links/:token
export async function resolveShareLink(token: string): Promise<IShareLinkResolution> {
  const { data } = await apiClient.get<IShareLinkResolution>(`/api/links/${token}`);
  return data;
}
