import { Controller, Get, Query } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { AnalyticsService } from './analytics.service';

const limiter = new Bottleneck({ minTime: 500 });

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('leads')
  async getLeadAnalytics(@Query('memberId') memberId: string) {
    return limiter.schedule(() =>
      this.analyticsService.getLeadAnalytics(memberId),
    );
  }

  @Get('deals')
  async getDealAnalytics(@Query('memberId') memberId: string) {
    return limiter.schedule(() =>
      this.analyticsService.getDealAnalytics(memberId),
    );
  }

  @Get('tasks')
  async getTaskAnalytics(@Query('memberId') memberId: string) {
    return limiter.schedule(() =>
      this.analyticsService.getTaskAnalytics(memberId),
    );
  }
}
