import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryString } from '../lib/api-client';
import type { ReportSummary } from '../lib/types';

export type ReportPeriod = 'today' | '7d' | '30d' | '90d';

export interface ReportFilters {
  status?: string;
  priority?: string;
  sectorId?: string;
  categoryId?: string;
  uncategorized?: boolean;
  assigneeId?: string;
  unassigned?: boolean;
  equipmentId?: string;
}

export function useReportSummary(period: ReportPeriod, filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', period, filters],
    queryFn: () => api.get<ReportSummary>(`/reports/summary${queryString({ period, ...filters })}`),
    placeholderData: keepPreviousData,
  });
}
