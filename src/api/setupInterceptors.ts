import apiClient from './apiClient';

export function setupInterceptors(
  logout: () => void,
  navigate: (path: string) => void,
): number {
  const id = apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        logout();
        navigate('/register');
      }
      return Promise.reject(error);
    },
  );
  return id;
}

export function ejectInterceptor(id: number): void {
  apiClient.interceptors.response.eject(id);
}
