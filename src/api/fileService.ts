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

// GET /api/files — root-level files (no folder)
export async function getRootFiles(): Promise<IFile[]> {
  const { data } = await apiClient.get<{ files: IFile[] }>('/api/files');
  return data.files;
}

// Upload via presigned S3 URL for real byte-level progress
export async function uploadFile(payload: UploadFilePayload): Promise<UploadFileResponse> {
  // Step 1 — Get a presigned URL
  const { data: presignData } = await apiClient.get<{
    presignedUrl: string;
    s3Key: string;
    fileId: string;
  }>('/api/files/presign-upload', {
    params: {
      name: payload.file.name,
      mimeType: payload.file.type || 'application/octet-stream',
      sizeBytes: payload.file.size,
      folderId: payload.folderId,
    },
  });

  // Step 2 — Upload directly to S3 via XMLHttpRequest for progress events
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (payload.onUploadProgress) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable) {
          payload.onUploadProgress!({
            loaded: event.loaded,
            total: event.total,
            progress: event.loaded / event.total,
            bytes: event.loaded,
            rate: undefined,
            estimated: undefined,
            upload: true,
            download: false,
            event,
          } as import('axios').AxiosProgressEvent);
        }
      };
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Upload failed — network error'));
    xhr.open('PUT', presignData.presignedUrl);
    xhr.setRequestHeader('Content-Type', payload.file.type || 'application/octet-stream');
    xhr.send(payload.file);
  });

  // Step 3 — Register the file in the DB
  const name = payload.name ?? payload.file.name;
  const { data } = await apiClient.post('/api/files/register', {
    fileId: presignData.fileId,
    name,
    s3Key: presignData.s3Key,
    sizeBytes: payload.file.size,
    mimeType: payload.file.type || 'application/octet-stream',
    folderId: payload.folderId ?? null,
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

// PATCH /api/files/:id/move
export async function moveFile(id: string, folderId: string | null): Promise<IFile> {
  const { data } = await apiClient.patch<{ file: IFile }>(`/api/files/${id}/move`, { folderId });
  return data.file;
}
