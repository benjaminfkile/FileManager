import axios from 'axios';
import apiClient from './apiClient';
import { IFile, IFolder, IShareLink } from '../types';

// Separate axios instance with no auth header for public endpoints
const publicClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3007',
});

export interface CreateShareLinkPayload {
  itemType: 'file' | 'folder';
  itemId: string;
  expiresAt?: string | null; // ISO string, or null/undefined for no expiry
}

export interface ShareLinkResponse {
  link: IShareLink;
}

export interface ShareLinksResponse {
  links: IShareLink[];
}

export interface ResolvedFileLinkResponse {
  linkInfo: { expires_at: string | null };
  itemType: 'file';
  file: IFile;
}

export interface ResolvedFolderLinkResponse {
  linkInfo: { expires_at: string | null };
  itemType: 'folder';
  folder: IFolder;
  subFolders: IFolder[];
  files: IFile[];
}

export type ResolvedLinkResponse = ResolvedFileLinkResponse | ResolvedFolderLinkResponse;

export interface PreviewViaLinkResponse {
  url: string;
  mimeType: string;
  expiresAt: string;
}

export interface BrowseFolderViaLinkResponse {
  folder: IFolder;
  subFolders: IFolder[];
  files: IFile[];
}

// POST /api/share-links
export async function createShareLink(payload: CreateShareLinkPayload): Promise<ShareLinkResponse> {
  const { data } = await apiClient.post<ShareLinkResponse>('/api/share-links', payload);
  return data;
}

// DELETE /api/share-links/:token
export async function revokeShareLink(token: string): Promise<void> {
  await apiClient.delete(`/api/share-links/${token}`);
}

// GET /api/share-links/item/:itemType/:itemId
export async function getShareLinksForItem(
  itemType: 'file' | 'folder',
  itemId: string
): Promise<ShareLinksResponse> {
  const { data } = await apiClient.get<ShareLinksResponse>(
    `/api/share-links/item/${itemType}/${itemId}`
  );
  return data;
}

// GET /api/share-links/:token (public)
export async function resolveShareLink(token: string): Promise<ResolvedLinkResponse> {
  const { data } = await publicClient.get<ResolvedLinkResponse>(`/api/share-links/${token}`);
  return data;
}

// GET /api/share-links/:token/folders/:folderId (public)
export async function browseFolderViaLink(
  token: string,
  folderId: string
): Promise<BrowseFolderViaLinkResponse> {
  const { data } = await publicClient.get<BrowseFolderViaLinkResponse>(
    `/api/share-links/${token}/folders/${folderId}`
  );
  return data;
}

// GET /api/share-links/:token/files/:fileId/preview (public)
export async function previewFileViaLink(
  token: string,
  fileId: string
): Promise<PreviewViaLinkResponse> {
  const { data } = await publicClient.get<PreviewViaLinkResponse>(
    `/api/share-links/${token}/files/${fileId}/preview`
  );
  return data;
}

// GET /api/share-links/:token/files/:fileId/download (public) — returns a Blob
export async function downloadFileViaLink(token: string, fileId: string): Promise<Blob> {
  const { data } = await publicClient.get<Blob>(
    `/api/share-links/${token}/files/${fileId}/download`,
    { responseType: 'blob' }
  );
  return data;
}

// GET /api/share-links/:token/folders/:folderId/download (public) — returns a Blob (zip)
export async function downloadFolderViaLink(token: string, folderId: string): Promise<Blob> {
  const { data } = await publicClient.get<Blob>(
    `/api/share-links/${token}/folders/${folderId}/download`,
    { responseType: 'blob' }
  );
  return data;
}
