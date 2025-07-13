import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
  ) {}

  async getLeadStats(memberId: string) {
    const cacheKey = 'analytics:leads';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const batchUrl = `https://${domain}/rest/batch`;
    const batchBody = {
      halt: 0,
      cmd: {
        leads: 'crm.lead.list',
        deals: 'crm.deal.list',
      },
    };

    const { data } = await firstValueFrom(
      this.httpService.post(batchUrl, batchBody, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const leads = data.result.result.leads;
    const deals = data.result.result.deals;

    const leadByStatus = leads.reduce(
      (acc, lead) => {
        acc[lead.STATUS_ID] = (acc[lead.STATUS_ID] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>,
    );

    const convertedLeads = deals
      .filter((deal) => deal.LEAD_ID)
      .map((deal) => deal.DEAL_ID);
    const conversionRate =
      leads.length === 0 ? 0 : convertedLeads.length / leads.length;

    const result = {
      leadByStatus,
      totalLeads: leads.length,
      convertedLeads: convertedLeads.length,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
    };

    await this.redisService.set(cacheKey, JSON.stringify(result), 900);

    return result;
  }

  async getDealStats(memberId: string) {
    const cacheKey = 'analytics:deals';
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/crm.deal.list`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    const deals = data.result;
    const totalRevenue = deals.reduce(
      (sum, deal) => sum + Number(deal.OPPORTUNITY || 0),
      0,
    );

    const today = new Date();
    const revenueByDate: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = date.toISOString().split('T')[0];
      revenueByDate[key] = 0;
    }

    for (const deal of deals) {
      const date = new Date(deal.DATE_CREATE).toISOString().split('T')[0];
      if (revenueByDate[date] !== undefined) {
        revenueByDate[date] += Number(deal.OPPORTUNITY || 0);
      }
    }

    const result = { totalRevenue, revenueByDate };

    await this.redisService.set(cacheKey, JSON.stringify(result), 900);

    return result;
  }

  async getTaskStats(memberId: string) {
    const cacheKey = 'analytics:tasks';
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/tasks.task.list`,
        { filter: { STATUS: '5' } }, // STATUS 5 = completed
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    const tasks = data.result.tasks;

    const taskCountByUser = tasks.reduce(
      (acc, task) => {
        const userId = task.RESPONSIBLE_ID;
        if (userId && userId !== 'null' && userId !== 'undefined') {
          acc[userId] = (acc[userId] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const result = { completedTasks: tasks.length, taskCountByUser };

    await this.redisService.set(cacheKey, JSON.stringify(result), 900);

    return result;
  }
}
