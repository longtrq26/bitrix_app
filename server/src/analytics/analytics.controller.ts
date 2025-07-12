import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('leads')
  async getLeadAnalytics(@Query('memberId') memberId: string) {
    return this.analyticsService.getLeadStats(memberId);
  }

  @Get('deals')
  async getDealAnalytics(@Query('memberId') memberId: string) {
    return this.analyticsService.getDealStats(memberId);
  }

  @Get('task')
  async getTaskAnalytics(@Query('memberId') memberId: string) {
    return this.analyticsService.getTaskStats(memberId);
  }
}
