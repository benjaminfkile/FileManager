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

export interface PartUrl {
  partNumber: number;
  url: string;
}

export interface PartUrlsResponse {
  urls: PartUrl[];
  expiresAt: string;
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

/**
 * POST /api/files/uploads/:fileId/part-urls — Returns one presigned S3 PUT
 * URL per requested part number. The browser uses these URLs to upload
 * chunks directly to S3, bypassing the API server entirely.
 */
export async function getPartUrls(
  fileId: string,
  partNumbers: number[],
): Promise<PartUrl[]> {
  const { data } = await apiClient.post<PartUrlsResponse>(
    `/api/files/uploads/${fileId}/part-urls`,
    { partNumbers },
  );
  return data.urls;
}

/**
 * Uploads one chunk directly to S3 via a presigned PUT URL. The API server
 * never sees the bytes. Returns `{ partNumber, etag }` where the ETag comes
 * from the S3 response header.
 */
export async function uploadPartToUrl(payload: {
  url: string;
  partNumber: number;
  chunk: Blob;
}): Promise<UploadPartResponse> {
  const { url, partNumber, chunk } = payload;
  const response = await fetch(url, {
    method: 'PUT',
    body: chunk,
  });
  if (!response.ok) {
    throw new Error(
      `S3 part upload failed: ${response.status} ${response.statusText}`,
    );
  }
  const etag = response.headers.get('ETag');
  if (!etag) {
    throw new Error('S3 part upload response missing ETag header');
  }
  return { partNumber, etag };
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
