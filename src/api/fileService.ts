import { AxiosProgressEvent } from 'axios';
import apiClient from './apiClient';
import { IFile, ISharedUser } from '../types';

export interface UploadFilePayload {
  file: File;
  folderId?: string;
  name?: string;
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
}

export interface UploadFileResponse {
  file: IFile;
}

export interface PreviewFileResponse {
  url: string;
  mimeType: string;
  expiresAt: string;
}

export interface ShareFileResponse {
  sharedWith: ISharedUser;
}

export interface GetFileSharesResponse {
  sharedWith: ISharedUser[];
}

// POST /api/files/upload
export async function uploadFile(payload: UploadFilePayload): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.folderId) {
    formData.append('folderId', payload.folderId);
  }
  if (payload.name) {
    formData.append('name', payload.name);
  }
  const { data } = await apiClient.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: payload.onUploadProgress,
  });
  return data as UploadFileResponse;
}

// GET /api/files/:id/download — streams the file; returns a Blob ready for saving
export async function downloadFile(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/api/files/${id}/download`, {
    responseType: 'blob',
  });
  return data;
}

// GET /api/files/:id/preview
export async function previewFile(id: string): Promise<PreviewFileResponse> {
  const { data } = await apiClient.get<PreviewFileResponse>(`/api/files/${id}/preview`);
  return data;
}

// PATCH /api/files/:id
export async function renameFile(id: string, name: string): Promise<IFile> {
  const { data } = await apiClient.patch<{ data: IFile }>(`/api/files/${id}`, { name });
  return data.data;
}

// DELETE /api/files/:id
export async function deleteFile(id: string): Promise<void> {
  await apiClient.delete(`/api/files/${id}`);
}

// POST /api/files/:id/restore
export async function restoreFile(id: string): Promise<IFile> {
  const { data } = await apiClient.post<{ data: IFile }>(`/api/files/${id}/restore`);
  return data.data;
}

// DELETE /api/files/:id/permanent
export async function permanentDeleteFile(id: string): Promise<void> {
  await apiClient.delete(`/api/files/${id}/permanent`);
}

// POST /api/files/:id/share
export async function shareFile(id: string, username: string): Promise<ShareFileResponse> {
  const { data } = await apiClient.post<ShareFileResponse>(`/api/files/${id}/share`, { username });
  return data;
}

// DELETE /api/files/:id/share/:sharedUserId
export async function unshareFile(id: string, sharedUserId: string): Promise<void> {
  await apiClient.delete(`/api/files/${id}/share/${sharedUserId}`);
}

// GET /api/files/:id/shares
export async function getFileShares(id: string): Promise<GetFileSharesResponse> {
  const { data } = await apiClient.get<GetFileSharesResponse>(`/api/files/${id}/shares`);
  return data;
}
