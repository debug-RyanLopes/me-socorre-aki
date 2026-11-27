import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryString } from '../lib/api-client';
import type { Page, TicketComment, TicketDetail, TicketListItem } from '../lib/types';

export interface TicketFilters {
  status?: string;
  priority?: string;
  sectorId?: number | string;
  categoryId?: number | string;
  uncategorized?: boolean;
  assigneeId?: number | string;
  equipmentId?: number | string;
  unassigned?: boolean;
  mine?: boolean;
  from?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function useTicketList(filters: TicketFilters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.get<Page<TicketListItem>>(`/tickets${queryString({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: number) {
  return useQuery({ queryKey: ['ticket', id], queryFn: () => api.get<TicketDetail>(`/tickets/${id}`) });
}

export function useTicketComments(id: number) {
  return useQuery({
    queryKey: ['ticket', id, 'comments'],
    queryFn: () => api.get<TicketComment[]>(`/tickets/${id}/comments`),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.post<TicketDetail>('/tickets', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useCreateComment(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.post<TicketComment>(`/tickets/${ticketId}/comments`, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useTicketAction(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      api.post<TicketDetail>(`/tickets/${ticketId}/${path}`, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(['ticket', ticketId], detail);
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'comments'] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useAssumeFromQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<TicketDetail>(`/tickets/${id}/assume`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });
}
