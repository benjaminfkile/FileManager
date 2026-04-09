import apiClient from './apiClient';
import { IFolder, IFile } from '../types';

export interface SharedWithMeResponse {
  files: IFile[];
  folders: IFolder[];
}

// GET /api/shared
export async function getSharedWithMe(): Promise<SharedWithMeResponse> {
  const { data } = await apiClient.get<SharedWithMeResponse>('/api/shared');
  return data;
}
