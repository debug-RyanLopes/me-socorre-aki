import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { CatalogItem, PriorityRules } from '../lib/types';

export type CatalogKind = 'sectors' | 'categories';

export function useCatalog(kind: CatalogKind, includeInactive = false) {
  return useQuery({
    queryKey: [kind, includeInactive],
    queryFn: () => api.get<CatalogItem[]>(`/${kind}${includeInactive ? '?includeInactive=true' : ''}`),
    staleTime: 60_000,
  });
}

export function useCatalogMutations(kind: CatalogKind) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [kind] });
  const create = useMutation({
    mutationFn: (name: string) => api.post<CatalogItem>(`/${kind}`, { name }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; active?: boolean }) =>
      api.patch<CatalogItem>(`/${kind}/${id}`, body),
    onSuccess: refresh,
  });
  return { create, update };
}

export function usePriorityRules() {
  return useQuery({ queryKey: ['priority-rules'], queryFn: () => api.get<PriorityRules>('/priority-rules') });
}

export function useSavePriorityRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ weights, thresholds }: PriorityRules) =>
      api.put<PriorityRules>('/priority-rules', { weights, thresholds }),
    onSuccess: (data) => queryClient.setQueryData(['priority-rules'], data),
  });
}
