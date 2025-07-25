import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as qs from 'qs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { buildCacheKey } from 'src/common/utils/build-cache-key';
import { RedisService } from 'src/redis/redis.service';
import { Logger } from 'winston';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  private readonly limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 500,
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
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
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
    this.limiter.on('depleted', () => {
      this.logger.debug('Bottleneck queue is depleted.');
    });
    this.limiter.on('queued', () => {
      this.logger.debug('Request queued in Bottleneck.');
    });
  }

  async getLeads(dto: QueryLeadDto, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const domain =
          dto.domain || (await this.authService.getDomain(memberId));
        this.validateDomain(domain);

        const page = Number(dto.page) || 1;
        const limit = Number(dto.limit) || 50;
        const start = (page - 1) * limit;

        const cacheKey = buildCacheKey(memberId, dto);
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            this.logger.debug(`Cache hit for leads: ${cacheKey}`, { memberId });
            return parsed;
          } catch (error) {
            this.logger.warn(
              `Failed to parse cached leads for key: ${cacheKey}, deleting cache`,
              { memberId, error },
            );
            await this.redisService.del(cacheKey);
          }
        }

        const url = `https://${domain}/rest/batch`;
        const cmd = this.buildLeadBatchQuery({ ...dto, start });

        const response = await firstValueFrom(
          this.httpService.post(
            url,
            { halt: 0, cmd },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );

        this.logger.debug(`Batch response for leads`, {
          memberId,
          response: response.data,
        });

        const data = response.data?.result?.result || {};
        const error = response.data?.result?.error;

        if (error) {
          this.logger.error(`Batch API error`, { memberId, error });
          throw new HttpException(
            error?.leads?.error_description || 'Failed to fetch leads',
            error?.leads?.error || HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const result = {
          leads: data?.leads || [],
          fields: data?.fields || {},
          statuses: data?.statuses || [],
          sources: data?.sources || [],
          total: data?.leads?.total || 0,
          page,
          limit,
        };

        await this.redisService.set(cacheKey, JSON.stringify(result), 600);

        this.logger.info(`Fetched and cached leads`, {
          memberId,
          leadCount: result.leads.length,
        });

        return result;
      }, memberId),
    );
  }

  async getLead(id: string, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const leadId = Number(id);
        if (isNaN(leadId) || leadId <= 0) {
          this.logger.error(`Invalid lead ID: ${id}`, { memberId });
          throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
        }

        const domain = await this.authService.getDomain(memberId);
        this.validateDomain(domain);

        const cacheKey = `lead:${memberId}:${leadId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            this.logger.debug(`Cache hit for lead: ${cacheKey}`, {
              memberId,
              leadId,
            });
            return parsed;
          } catch (error) {
            this.logger.warn(
              `Failed to parse cached lead for key: ${cacheKey}, deleting cache`,
              { memberId, leadId, error },
            );
            await this.redisService.del(cacheKey);
          }
        }

        const response = await firstValueFrom(
          this.httpService.get(
            `https://${domain}/rest/crm.lead.get?id=${leadId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );

        const lead = response.data.result || {};

        await this.redisService.set(cacheKey, JSON.stringify(lead), 600);

        this.logger.info(`Fetched and cached lead ${leadId}`, { memberId });

        return lead;
      }, memberId),
    );
  }

  async createLead(dto: CreateLeadDto, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const domain =
          dto.domain || (await this.authService.getDomain(memberId));
        this.validateDomain(domain);

        const payload = {
          fields: {
            TITLE: dto.TITLE,
            NAME: dto.NAME,
            STATUS_ID: dto.STATUS_ID,
            SOURCE_ID: dto.SOURCE_ID,
            COMMENTS: dto.COMMENTS,
            ...(dto.EMAIL && {
              EMAIL: [{ VALUE: dto.EMAIL, VALUE_TYPE: 'WORK' }],
            }),
            ...(dto.PHONE && {
              PHONE: [{ VALUE: dto.PHONE, VALUE_TYPE: 'WORK' }],
            }),
          },
        };

        const response = await firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.add`,
            payload,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        );

        this.logger.info(`Lead created successfully`, {
          memberId,
          leadId: response.data.result,
        });

        await this.redisService.delByPrefix(`leads:${memberId}`);

        return response.data.result;
      }, memberId),
    );
  }

  async updateLead(id: string, dto: UpdateLeadDto, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const leadId = Number(id);
        if (isNaN(leadId) || leadId <= 0) {
          this.logger.error(`Invalid lead ID: ${id}`, { memberId });
          throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
        }

        const domain =
          dto.domain || (await this.authService.getDomain(memberId));
        this.validateDomain(domain);

        const payload = {
          fields: {
            ...(dto.TITLE && { TITLE: dto.TITLE }),
            ...(dto.NAME && { NAME: dto.NAME }),
            ...(dto.STATUS_ID && { STATUS_ID: dto.STATUS_ID }),
            ...(dto.SOURCE_ID && { SOURCE_ID: dto.SOURCE_ID }),
            ...(dto.COMMENTS && { COMMENTS: dto.COMMENTS }),
            ...(dto.EMAIL && {
              EMAIL: [{ VALUE: dto.EMAIL, VALUE_TYPE: 'WORK' }],
            }),
            ...(dto.PHONE && {
              PHONE: [{ VALUE: dto.PHONE, VALUE_TYPE: 'WORK' }],
            }),
          },
        };

        const response = await firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.update?id=${leadId}`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );

        this.logger.info(`Lead updated successfully`, { memberId, leadId });

        await this.redisService.delByPrefix(`leads:${memberId}`);

        return response.data.result;
      }, memberId),
    );
  }

  async deleteLead(id: string, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const leadId = Number(id);
        if (isNaN(leadId) || leadId <= 0) {
          this.logger.error(`Invalid lead ID: ${id}`, { memberId });
          throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
        }

        const domain = await this.authService.getDomain(memberId);
        this.validateDomain(domain);

        const deleteUrl = `https://${domain}/rest/crm.lead.delete?id=${leadId}`;

        const response = await firstValueFrom(
          this.httpService.post(
            deleteUrl,
            {},
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );

        this.logger.info(`Lead deleted successfully`, { memberId, leadId });

        await this.redisService.delByPrefix(`leads:${memberId}`);

        return response.data.result;
      }, memberId),
    );
  }

  async getLeadTasks(id: string, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const leadId = Number(id);
        if (isNaN(leadId) || leadId <= 0) {
          this.logger.error(`Invalid lead ID: ${id}`, { memberId });
          throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
        }

        const domain = await this.authService.getDomain(memberId);
        this.validateDomain(domain);

        const response = await firstValueFrom(
          this.httpService.get(
            `https://${domain}/rest/tasks.task.list?filter[LEAD_ID]=${leadId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );

        this.logger.debug(`Tasks response for lead ${leadId}`, {
          memberId,
          response: response.data,
        });

        return (
          response.data.result.tasks?.map((task) => ({
            ID: task.id || 'N/A',
            TITLE: task.title || 'N/A',
            STATUS: task.status || 'N/A',
          })) || []
        );
      }, memberId),
    );
  }

  async getLeadDeals(id: string, memberId: string) {
    return this.limiter.schedule(() =>
      this.executeWithRetry(async (token: string) => {
        const leadId = Number(id);
        if (isNaN(leadId) || leadId <= 0) {
          this.logger.error(`Invalid lead ID: ${id}`, { memberId });
          throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
        }

        const domain = await this.authService.getDomain(memberId);
        this.validateDomain(domain);

        const response = await firstValueFrom(
          this.httpService.get(
            `https://${domain}/rest/crm.deal.list?filter[LEAD_ID]=${leadId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );

        this.logger.debug(`Deals response for lead ${leadId}`, {
          memberId,
          response: response.data,
        });

        return (
          response.data.result?.map((deal) => ({
            ID: deal.id || deal.ID || 'N/A',
            TITLE: deal.title || deal.TITLE || 'N/A',
            OPPORTUNITY: deal.opportunity || deal.OPPORTUNITY || 'N/A',
          })) || []
        );
      }, memberId),
    );
  }

  private async executeWithRetry<T>(
    fn: (token: string) => Promise<T>,
    memberId: string,
  ): Promise<T> {
    try {
      const accessToken = await this.authService.getAccessToken(memberId);
      if (!accessToken) {
        this.logger.error(`No access token for memberId: ${memberId}`);
        throw new UnauthorizedException('Access token not available.');
      }
      return await fn(accessToken);
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.warn(
          `Access token expired for memberId: ${memberId}, attempting refresh`,
        );
        const newToken = await this.authService.refreshToken(memberId);
        return await fn(newToken);
      }
      this.logger.error(`Operation failed for memberId: ${memberId}`, {
        error,
      });
      throw new HttpException(
        error.response?.data?.error_description ||
          error.message ||
          'Operation failed',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private validateDomain(domain: string | undefined) {
    if (!domain || !domain.endsWith('.bitrix24.vn')) {
      this.logger.error(`Invalid domain: ${domain}`);
      throw new HttpException('Invalid domain', HttpStatus.BAD_REQUEST);
    }
  }

  private buildLeadBatchQuery(dto: QueryLeadDto & { start?: number }) {
    const filter: Record<string, any> = {};
    const order: Record<string, string> = {};

    if (dto.find) {
      filter['LOGIC'] = 'OR';
      filter['%TITLE'] = dto.find;
      filter['%NAME'] = dto.find;
      filter['%EMAIL'] = dto.find;
    }
    if (dto.status) filter['STATUS_ID'] = dto.status;
    if (dto.source) filter['SOURCE_ID'] = dto.source;
    if (dto.date) {
      try {
        const parsedDate =
          new Date(dto.date).toISOString().split('T')[0] + ' 00:00:00';
        filter['>=DATE_CREATE'] = parsedDate;
      } catch (error) {
        this.logger.warn(`Invalid date format: ${dto.date}`);
      }
    }

    const sortField = dto.sort || 'DATE_CREATE';
    order[sortField] = 'DESC';

    const query = qs.stringify(
      { filter, order, start: dto.start || 0, select: ['*', 'EMAIL', 'PHONE'] },
      {
        encode: true,
        arrayFormat: 'brackets',
        allowDots: true,
      },
    );

    return {
      leads: `crm.lead.list?${query}`,
      fields: 'crm.lead.fields',
      statuses: 'crm.status.list?filter[ENTITY_ID]=STATUS',
      sources: 'crm.status.list?filter[ENTITY_ID]=SOURCE',
    };
  }
}
