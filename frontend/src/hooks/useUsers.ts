import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryString } from '../lib/api-client';
import type { Page, Role, UserView } from '../lib/types';

export interface UserFilters {
  q?: string;
  role?: string;
  sectorId?: string;
  active?: string;
  page?: number;
  pageSize?: number;
}

export interface UserInput {
  name: string;
  email: string;
  login: string;
  role: Role;
  sectorId: number;
  temporaryPassword?: string;
}

export function useUsers(filters: UserFilters, enabled = true) {
  return useQuery({
    queryKey: ['users', filters],
    enabled,
    queryFn: () => api.get<Page<UserView>>(`/users${queryString({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: ['user', id],
    enabled: id !== null,
    queryFn: () => api.get<UserView>(`/users/${id}`),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserInput) => api.post<UserView>('/users', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserInput>) => api.patch<UserView>(`/users/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

export function useUserAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'deactivate' | 'reactivate' | 'reset-password' }) =>
      api.post<UserView & { temporaryPassword?: string }>(`/users/${id}/${action}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
