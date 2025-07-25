import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { Logger } from 'winston';

type BitrixBatchResponse = {
  result: {
    result: {
      leads?: Array<{ STATUS_ID: string }>;
      deals?: Array<{ OPPORTUNITY?: string; DATE_CREATE?: string }>;
      tasks?: { tasks: Array<{ responsibleId: string; status: string }> };
    };
  };
};

type LeadStats = {
  NEW: number;
  IN_PROCESS: number;
  CONVERTED: number;
  LOST: number;
};

@Injectable()
export class AnalyticsService {
  private readonly limiter = new Bottleneck({
    maxConcurrent: 2,
    minTime: 333,
    retryOptions: {
      maxRetries: 3,
      delay: (retryCount) => retryCount * 1000,
      retryOn: (error: AxiosError) => {
        const status = error?.response?.status;
        const shouldRetry = status === 429 || (status && status >= 500);
        if (shouldRetry) {
          this.logger.warn(
            `Retrying request due to status code: ${status}. Attempt: ${error.config?.url}`,
          );
        }
        return shouldRetry;
      },
    },
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.limiter.on('failed', (error, info) => {
      this.logger.error(
        `Bottleneck request failed: ${error.message}. Retries left: ${info.retryCount}.`,
      );
    });
    this.limiter.on('error', (error) => {
      this.logger.error(
        `Bottleneck encountered an unhandled error: ${error.message}`,
      );
    });
  }

  async getLeadAnalytics(memberId: string) {
    if (!memberId) {
      this.logger.error('Invalid memberId');
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    const cacheKey = `analytics:leads:${memberId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.info(`Returning cached lead analytics`, { memberId });
      return JSON.parse(cached);
    }

    const { leads = [] } = await this.callBatchAPI(memberId, {
      leads: 'crm.lead.list',
    });

    if (!Array.isArray(leads)) {
      this.logger.error(`Invalid lead analytics format`, { memberId, leads });
      throw new HttpException(
        'Invalid lead analytics format',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const stats: LeadStats = {
      NEW: leads.filter((l) => l.STATUS_ID === 'NEW').length,
      IN_PROCESS: leads.filter((l) => l.STATUS_ID === 'IN_PROCESS').length,
      CONVERTED: leads.filter((l) => l.STATUS_ID === 'CONVERTED').length,
      LOST: leads.filter((l) => l.STATUS_ID === 'LOST').length,
    };

    this.logger.info(`Processed lead analytics`, {
      memberId,
      leadCount: leads.length,
      stats,
    });

    await this.redisService.set(cacheKey, JSON.stringify(stats), 900);
    return stats;
  }

  async getDealAnalytics(memberId: string) {
    if (!memberId) {
      this.logger.error('Invalid memberId');
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    const cacheKey = `analytics:deals:${memberId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.info(`Returning cached deal analytics`, { memberId });
      return JSON.parse(cached);
    }

    const { deals = [], leads: convertedLeads = [] } = await this.callBatchAPI(
      memberId,
      {
        deals: 'crm.deal.list',
        leads: 'crm.lead.list?filter[STATUS_ID]=CONVERTED',
      },
    );

    if (!Array.isArray(deals) || !Array.isArray(convertedLeads)) {
      this.logger.error(`Invalid deal analytics format`, {
        memberId,
        deals,
        convertedLeads,
      });
      throw new HttpException(
        'Invalid deal analytics format',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const leadStats = await this.getLeadAnalytics(memberId);
    const totalLeads: number = (Object.values(leadStats) as number[]).reduce(
      (sum: number, v: number) => sum + v,
      0,
    );
    const conversionRate =
      totalLeads > 0 ? convertedLeads.length / totalLeads : 0;

    const revenue = deals.reduce(
      (sum, d) => sum + parseFloat(d.OPPORTUNITY || '0'),
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
        .filter((d) => d.DATE_CREATE?.split('T')[0] === date)
        .reduce((sum, d) => sum + parseFloat(d.OPPORTUNITY || '0'), 0),
    }));

    const stats = { conversionRate, revenue, revenueByDay };

    this.logger.info(`Processed deal analytics`, {
      memberId,
      dealCount: deals.length,
      stats: Object.keys(stats),
    });

    await this.redisService.set(cacheKey, JSON.stringify(stats), 900);
    return stats;
  }

  async getTaskAnalytics(memberId: string) {
    if (!memberId) {
      this.logger.error('Invalid memberId');
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    const cacheKey = `analytics:tasks:${memberId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.info(`Returning cached task analytics`, { memberId });
      return JSON.parse(cached);
    }

    const { tasks: taskWrapper = {} } = await this.callBatchAPI(memberId, {
      tasks: 'tasks.task.list',
    });

    const tasks = taskWrapper.tasks || [];
    if (!Array.isArray(tasks)) {
      this.logger.error(`Invalid task analytics format`, { memberId, tasks });
      throw new HttpException(
        'Invalid task analytics format',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const stats = tasks.reduce(
      (acc, task) => {
        const id = task.responsibleId;
        if (id && task.status === '5') {
          acc[id] = (acc[id] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    this.logger.info(`Processed task analytics`, {
      memberId,
      taskCount: tasks.length,
      responsibleUsers: Object.keys(stats),
    });

    await this.redisService.set(cacheKey, JSON.stringify(stats), 900);
    return stats;
  }

  private async callBatchAPI(
    memberId: string,
    cmd: Record<string, string>,
  ): Promise<Record<string, any>> {
    if (!memberId) {
      this.logger.error('Invalid memberId in callBatchAPI');
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    try {
      const response = await this.fetchWithRetry<BitrixBatchResponse>(
        '/rest/batch',
        memberId,
        {
          method: 'POST',
          data: { halt: 0, cmd },
        },
        `batch command for ${Object.keys(cmd).join(', ')}`,
      );

      if (!response?.result?.result) {
        this.logger.error(`Invalid batch response`, { memberId, response });
        throw new HttpException(
          'Invalid batch response',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return response.result.result;
    } catch (error) {
      this.logger.error(`Failed to fetch batch analytics`, {
        memberId,
        error: error.message,
      });
      throw new HttpException(
        error?.response?.data?.error_description ||
          'Failed to fetch analytics data',
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async fetchWithRetry<T>(
    url: string,
    memberId: string,
    options: any,
    action: string,
  ): Promise<T> {
    if (!memberId) {
      this.logger.error('Invalid memberId in fetchWithRetry');
      throw new HttpException('Invalid memberId', HttpStatus.BAD_REQUEST);
    }
    let token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const makeRequest = async (): Promise<T> => {
      const response = await firstValueFrom(
        this.httpService.request({
          ...options,
          url: `https://${domain}${url}`,
          headers: { Authorization: `Bearer ${token}`, ...options.headers },
        }),
      );
      return response.data;
    };

    try {
      return await this.limiter.schedule(() => makeRequest());
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.warn(
          `401 Unauthorized. Retrying ${action} for member ${memberId}`,
        );
        token = await this.authService.refreshToken(memberId);
        try {
          return await this.limiter.schedule(() => makeRequest());
        } catch (retryError) {
          this.logger.error(`Retry failed for ${action}`, {
            memberId,
            error: retryError.message,
          });
          throw retryError;
        }
      }

      this.logger.error(`Failed ${action}`, {
        memberId,
        error: error.message,
        status: error.response?.status,
      });

      throw error;
    }
  }
}
