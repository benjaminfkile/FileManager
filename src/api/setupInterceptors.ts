import apiClient from './apiClient';
import { getIdToken } from '../lib/cognitoClient';

export const SESSION_EXPIRED_FLASH_KEY = 'session_expired_flash';

export function setupInterceptors(
  logout: () => void,
  navigate: (path: string) => void,
): number {
  const id = apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // Server explicitly says the demo TTL elapsed — skip the refresh
        // dance and surface a friendly message on the login page.
        if (error.response?.data?.error === 'Session expired') {
          try {
            sessionStorage.setItem(SESSION_EXPIRED_FLASH_KEY, '1');
          } catch {
            // sessionStorage can fail in some private modes — fall through.
          }
          logout();
          navigate('/login');
          return Promise.reject(error);
        }

        const originalRequest = error.config;
        // Attempt a token refresh and retry the request exactly once before
        // forcing a logout. This prevents a mid-upload sign-out caused by a
        // transient Cognito token-refresh failure.
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          const token = await getIdToken();
          if (token) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          }
        }
        // Refresh failed or retry also got 401 — the session is truly gone.
        logout();
        navigate('/login');
      }
      return Promise.reject(error);
    },
  );
  return id;
}

export function ejectInterceptor(id: number): void {
  apiClient.interceptors.response.eject(id);
}
