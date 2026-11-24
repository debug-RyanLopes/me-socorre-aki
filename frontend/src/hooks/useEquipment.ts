import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryString } from '../lib/api-client';
import type { EquipmentType, EquipmentView, Page, PendingSerial } from '../lib/types';

export interface EquipmentFilters {
  q?: string;
  type?: string;
  sectorId?: string;
  page?: number;
  pageSize?: number;
}

export interface EquipmentInput {
  serial: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  sectorId: number;
  assetTag?: string;
  notes?: string;
}

export function useEquipmentList(filters: EquipmentFilters) {
  return useQuery({
    queryKey: ['equipment', filters],
    queryFn: () => api.get<Page<EquipmentView>>(`/equipment${queryString({ ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function usePendingSerials() {
  return useQuery({ queryKey: ['equipment', 'pending'], queryFn: () => api.get<PendingSerial[]>('/equipment/pending') });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EquipmentInput) => api.post<EquipmentView>('/equipment', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
