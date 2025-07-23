import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
  ) {}

  async getLeadAnalytics(memberId: string) {
    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);
    this.logger.debug(`Domain: ${domain}, Token: ${token}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://${domain}/rest/batch`,
          {
            halt: 0,
            cmd: {
              leads: 'crm.lead.list',
            },
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.debug(
        `Lead analytics response: ${JSON.stringify(response.data)}`,
      );

      const leads = response.data.result.leads || [];
      const stats = {
        NEW: leads.filter((l) => l.STATUS_ID === 'NEW').length,
        IN_PROGRESS: leads.filter((l) => l.STATUS_ID === 'IN_PROGRESS').length,
        CONVERTED: leads.filter((l) => l.STATUS_ID === 'CONVERTED').length,
        LOST: leads.filter((l) => l.STATUS_ID === 'LOST').length,
      };

      await this.redisService.set(
        'analytics:leads',
        JSON.stringify(stats),
        900,
      );
      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to fetch lead analytics: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.response?.data?.error_description ||
          'Failed to fetch lead analytics',
        error.response?.status || 500,
      );
    }
  }

  async getDealAnalytics(memberId: string) {
    const cacheKey = 'analytics:deals';
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://${domain}/rest/batch`,
          {
            halt: 0,
            cmd: {
              deals: 'crm.deal.list',
              leads: 'crm.lead.list?filter[STATUS_ID]=CONVERTED',
            },
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      const deals = response.data.result.deals;
      const convertedLeads = response.data.result.leads.length;
      const totalLeads =
        (await this.getLeadAnalytics(memberId)).NEW +
        (await this.getLeadAnalytics(memberId)).IN_PROGRESS +
        (await this.getLeadAnalytics(memberId)).CONVERTED +
        (await this.getLeadAnalytics(memberId)).LOST;
      const conversionRate = convertedLeads / totalLeads;
      const revenue = deals.reduce(
        (sum, deal) => sum + (deal.OPPORTUNITY || 0),
        0,
      );
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();
      const revenueByDay = last7Days.map((date) => ({
        date,
        revenue: deals
          .filter((d) => d.DATE_CREATE.split('T')[0] === date)
          .reduce((sum, d) => sum + (d.OPPORTUNITY || 0), 0),
      }));
      const stats = { conversionRate, revenue, revenueByDay };

      await this.redisService.set(cacheKey, JSON.stringify(stats), 900);

      return stats;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch deal analytics',
        error.response?.status || 500,
      );
    }
  }

  async getTaskAnalytics(memberId: string) {
    const cacheKey = 'analytics:tasks';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        this.logger.error(
          `Failed to parse cached task analytics: ${error.message}`,
        );
      }
    }

    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);
    this.logger.debug(`Domain: ${domain}, Token: ${token}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://${domain}/rest/batch`,
          {
            halt: 0,
            cmd: {
              tasks: 'tasks.task.list',
            },
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.debug(
        `Task analytics response: ${JSON.stringify(response.data)}`,
      );

      const tasks = response.data.result.tasks || [];
      const stats = tasks.reduce((acc, task) => {
        acc[task.RESPONSIBLE_ID] =
          (acc[task.RESPONSIBLE_ID] || 0) + (task.STATUS === '5' ? 1 : 0);
        return acc;
      }, {});

      await this.redisService.set(cacheKey, JSON.stringify(stats), 900);
      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to fetch task analytics: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.response?.data?.error_description ||
          'Failed to fetch task analytics',
        error.response?.status || 500,
      );
    }
  }
}
