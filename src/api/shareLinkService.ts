import apiClient from './apiClient';
import { IPublicShareLink } from '../types';

function basePath(resourceType: 'file' | 'folder', resourceId: string): string {
  const segment = resourceType === 'file' ? 'files' : 'folders';
  return `/api/${segment}/${resourceId}/share-links`;
}

export async function getShareLinks(
  resourceType: 'file' | 'folder',
  resourceId: string,
): Promise<IPublicShareLink[]> {
  const { data } = await apiClient.get<IPublicShareLink[]>(basePath(resourceType, resourceId));
  return data;
}

export async function createShareLink(
  resourceType: 'file' | 'folder',
  resourceId: string,
  expiresAt: string | null,
): Promise<IPublicShareLink> {
  const { data } = await apiClient.post<IPublicShareLink>(basePath(resourceType, resourceId), {
    expiresAt,
  });
  return data;
}

export async function deleteShareLink(
  resourceType: 'file' | 'folder',
  resourceId: string,
  linkId: string,
): Promise<void> {
  await apiClient.delete(`${basePath(resourceType, resourceId)}/${linkId}`);
}
