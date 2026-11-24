import { IsIn, IsOptional } from 'class-validator';

export const REPORT_PERIODS = ['today', '7d', '30d'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export class ReportPeriodQuery {
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period: ReportPeriod = '7d';
}
