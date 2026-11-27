import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportPeriodQuery } from './dto/report-period.query';
import { ReportsService } from './reports.service';

@Roles('ADMIN')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Query() query: ReportPeriodQuery) {
    return this.reports.summary(query);
  }
}
