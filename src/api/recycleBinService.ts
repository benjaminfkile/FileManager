import apiClient from './apiClient';
import { IFolder, IFile } from '../types';

export interface RecycleBinResponse {
  folders: IFolder[];
  files: IFile[];
}

export interface RestoreAllResponse {
  restoredFolders: number;
  restoredFiles: number;
}

// GET /api/recycle-bin
export async function getRecycleBin(): Promise<RecycleBinResponse> {
  const { data } = await apiClient.get<RecycleBinResponse>('/api/recycle-bin');
  return data;
}

// POST /api/recycle-bin/restore-all
export async function restoreAll(): Promise<RestoreAllResponse> {
  const { data } = await apiClient.post<RestoreAllResponse>('/api/recycle-bin/restore-all');
  return data;
}

// DELETE /api/recycle-bin/empty
export async function emptyRecycleBin(): Promise<void> {
  await apiClient.delete('/api/recycle-bin/empty');
}
