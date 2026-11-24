import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { ReportSummary } from '../lib/types';

export type ReportPeriod = 'today' | '7d' | '30d';

export function useReportSummary(period: ReportPeriod) {
  return useQuery({
    queryKey: ['reports', period],
    queryFn: () => api.get<ReportSummary>(`/reports/summary?period=${period}`),
    placeholderData: keepPreviousData,
  });
}
