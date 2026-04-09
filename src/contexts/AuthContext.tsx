import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { IUser } from '../types';
import { getMe } from '../api/userService';
import { API_KEY_STORAGE_KEY } from '../api/apiClient';

interface AuthContextValue {
  apiKey: string | null;
  currentUser: IUser | null;
  isLoading: boolean;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(API_KEY_STORAGE_KEY));
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!localStorage.getItem(API_KEY_STORAGE_KEY));

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;

    setIsLoading(true);
    getMe()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(API_KEY_STORAGE_KEY);
          setApiKey(null);
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (key: string) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKey(key);
    const user = await getMe();
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey(null);
    setCurrentUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ apiKey, currentUser, isLoading, login, logout }),
    [apiKey, currentUser, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
