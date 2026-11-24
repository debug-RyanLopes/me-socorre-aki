import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { api, ApiError } from '../lib/api-client';
import type { AuthUser } from '../lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      try {
        return await api.get<AuthUser>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });

  const login = useCallback(
    async (loginName: string, password: string) => {
      const user = await api.post<AuthUser>('/auth/login', { login: loginName, password });
      queryClient.clear();
      queryClient.setQueryData(['me'], user);
      return user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    queryClient.clear();
    queryClient.setQueryData(['me'], null);
  }, [queryClient]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const user = await api.post<AuthUser>('/auth/change-password', { currentPassword, newPassword });
      queryClient.setQueryData(['me'], user);
      return user;
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user: me.data ?? null, loading: me.isLoading, login, logout, changePassword }),
    [me.data, me.isLoading, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
