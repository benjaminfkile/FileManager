import apiClient from './apiClient';
import { ISharedFile, ISharedFolder } from '../types';

export interface SharedWithMeResponse {
  files: ISharedFile[];
  folders: ISharedFolder[];
}

// GET /api/shared
export async function getSharedWithMe(): Promise<SharedWithMeResponse> {
  const { data } = await apiClient.get<SharedWithMeResponse>('/api/shared');
  return data;
}
