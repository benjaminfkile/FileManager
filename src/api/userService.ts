import apiClient from './apiClient';
import { IUser } from '../types';

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  username: string;
  api_key: string;
}

// POST /api/users/register — no auth header needed
export async function registerUser(payload: RegisterPayload): Promise<IUser> {
  const { data } = await apiClient.post<IUser>('/api/users/register', payload);
  return data;
}

// GET /api/users/me
export async function getMe(): Promise<IUser> {
  const { data } = await apiClient.get<IUser>('/api/users/me');
  return data;
}

// GET /api/users/search?q=<query>
export async function searchUsers(query: string): Promise<IUser[]> {
  const { data } = await apiClient.get<IUser[]>('/api/users/search', {
    params: { q: query },
  });
  return data;
}
