import apiClient from './apiClient';
import { IFile } from '../types';

export interface InitiateUploadResponse {
  uploadId: string;
  fileId: string;
  key: string;
}

export interface UploadPartResponse {
  partNumber: number;
  etag: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/** POST /api/files/uploads/initiate — Starts a multipart upload session. */
export async function initiateUpload(payload: {
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
}): Promise<InitiateUploadResponse> {
  const { data } = await apiClient.post<InitiateUploadResponse>(
    '/api/files/uploads/initiate',
    payload,
  );
  return data;
}

/** PUT /api/files/uploads/:fileId/parts/:partNumber — Uploads one chunk. */
export async function uploadPart(payload: {
  fileId: string;
  partNumber: number;
  chunk: Blob;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<UploadPartResponse> {
  const { fileId, partNumber, chunk, onProgress } = payload;
  const buffer = await chunk.arrayBuffer();

  const { data } = await apiClient.put<UploadPartResponse>(
    `/api/files/uploads/${fileId}/parts/${partNumber}`,
    buffer,
    {
      headers: { 'Content-Type': 'application/octet-stream' },
      onUploadProgress: onProgress
        ? (event) => onProgress(event.loaded, event.total ?? chunk.size)
        : undefined,
    },
  );
  return data;
}

/** POST /api/files/uploads/:fileId/complete — Finalises the multipart upload. */
export async function completeUpload(
  fileId: string,
  parts: CompletedPart[],
): Promise<IFile> {
  const { data } = await apiClient.post<IFile>(
    `/api/files/uploads/${fileId}/complete`,
    { parts },
  );
  return data;
}

/** DELETE /api/files/uploads/:fileId — Aborts the upload and cleans up. */
export async function abortUpload(fileId: string): Promise<void> {
  await apiClient.delete(`/api/files/uploads/${fileId}`);
}
