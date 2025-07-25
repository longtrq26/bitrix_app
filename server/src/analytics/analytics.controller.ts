import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { Logger } from 'winston';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
@UseGuards(OAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get('leads')
  async getLeadAnalytics(
    @Query('memberId') queryMemberId: string,
    @MemberId() memberId: string,
  ) {
    if (!memberId) {
      this.logger.error('Missing memberId from OAuthGuard');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    if (queryMemberId && queryMemberId !== memberId) {
      this.logger.error(`Invalid query memberId`, { queryMemberId, memberId });
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    this.logger.debug(`Fetching lead analytics`, { memberId });
    const stats = await this.analyticsService.getLeadAnalytics(memberId);
    this.logger.info(`Fetched lead analytics`, {
      memberId,
      stats: Object.keys(stats),
    });
    return stats;
  }

  @Get('deals')
  async getDealAnalytics(
    @Query('memberId') queryMemberId: string,
    @MemberId() memberId: string,
  ) {
    if (!memberId) {
      this.logger.error('Missing memberId from OAuthGuard');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    if (queryMemberId && queryMemberId !== memberId) {
      this.logger.error(`Invalid query memberId`, { queryMemberId, memberId });
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    this.logger.debug(`Fetching deal analytics`, { memberId });
    const stats = await this.analyticsService.getDealAnalytics(memberId);
    this.logger.info(`Fetched deal analytics`, {
      memberId,
      stats: Object.keys(stats),
    });
    return stats;
  }

  @Get('tasks')
  async getTaskAnalytics(
    @Query('memberId') queryMemberId: string,
    @MemberId() memberId: string,
  ) {
    if (!memberId) {
      this.logger.error('Missing memberId from OAuthGuard');
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    if (queryMemberId && queryMemberId !== memberId) {
      this.logger.error(`Invalid query memberId`, { queryMemberId, memberId });
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    this.logger.debug(`Fetching task analytics`, { memberId });
    const stats = await this.analyticsService.getTaskAnalytics(memberId);
    this.logger.info(`Fetched task analytics`, {
      memberId,
      stats: Object.keys(stats),
    });
    return stats;
  }
}
