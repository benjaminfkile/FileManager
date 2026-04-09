import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { IUser } from '../types';
import { getMe } from '../api/userService';
import { signIn, signOut, getIdToken } from '../lib/cognitoClient';

interface AuthContextValue {
  currentUser: IUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    getIdToken()
      .then((token) => {
        if (cancelled || !token) return null;
        return getMe();
      })
      .then((user) => {
        if (!cancelled && user) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          signOut();
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
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signIn(email, password);
    const user = await getMe();
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    signOut();
    setCurrentUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ currentUser, isLoading, login, logout }),
    [currentUser, isLoading, login, logout],
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
