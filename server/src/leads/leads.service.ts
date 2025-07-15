import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import Bottleneck from 'bottleneck';
import * as crypto from 'crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
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
    },
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async getLeads(dto: QueryLeadDto, memberId: string) {
    this.validateDomain(dto.domain);
    const cacheKey = this.buildCacheKey(memberId, dto);

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const endpoint = `https://${dto.domain}/rest/batch`;
    const filterParams = this.buildFilterParams(dto);
    const sortField = dto.sort || 'DATE_CREATE';
    const sortParam = `order[${sortField}]=DESC`;
    const paramString = [...filterParams, sortParam].join('&');

    const cmd = {
      leads: paramString ? `crm.lead.list?${paramString}` : `crm.lead.list`,
      fields: 'crm.lead.fields',
    };

    this.logger.debug(`Batch CMD: ${JSON.stringify(cmd)}`);

    try {
      const response = await this.limiter.schedule(() =>
        firstValueFrom(
          this.httpService.post(
            endpoint,
            { halt: 0, cmd },
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        ),
      );

      const data = response.data;
      if (!data || data.error) {
        const message = data?.error_description || 'Unknown Bitrix24 error';
        this.logger.error(`[LeadsService] Bitrix error: ${message}`);
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }

      const leads = data?.result?.result?.leads || [];
      const fields = data?.result?.result?.fields || {};
      const result = { leads, fields };

      if (leads.length === 0) {
        this.logger.warn(`[LeadsService] No leads found`);
      } else {
        this.logger.info(`[LeadsService] ${leads.length} leads fetched`);
      }

      await this.redisService.set(cacheKey, JSON.stringify(result), 600);

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch leads: ${error.message}`);
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to fetch leads',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createLead(dto: CreateLeadDto, memberId: string) {
    this.validateDomain(dto.domain);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`[LeadsService] No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const { domain, customFields, ...rest } = dto;
    const fields = { ...rest, ...(customFields || {}) };

    try {
      const response = await this.limiter.schedule(() =>
        firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.add`,
            { fields },
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        ),
      );

      const data = response.data;
      if (data.error) {
        this.logger.error(`Create lead error: ${data.error_description}`);
        throw new HttpException(data.error_description, HttpStatus.BAD_REQUEST);
      }

      this.logger.info(`[LeadsService] Lead created`);

      await this.redisService.deleteByPrefix(`leads:*:${memberId}`);

      return data;
    } catch (error) {
      this.logger.error(`Failed to create lead: ${error.message}`);
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to create lead',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateLead(id: string, dto: UpdateLeadDto, memberId: string) {
    this.validateDomain(dto.domain);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`[LeadsService] No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const { domain, customFields, ...rest } = dto;
    const fields = { ...rest, ...(customFields || {}) };

    try {
      const response = await this.limiter.schedule(() =>
        firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.update`,
            { id, fields },
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        ),
      );

      const data = response.data;
      if (data.error) {
        this.logger.error(
          `[LeadsService] Update lead error: ${data.error_description}`,
        );
        throw new HttpException(data.error_description, HttpStatus.BAD_REQUEST);
      }

      this.logger.info(`[LeadsService] Lead ${id} updated`);

      await this.redisService.deleteByPrefix(`leads:*:${memberId}`);

      return data;
    } catch (error) {
      this.logger.error(`Failed to update lead: ${error.message}`);
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to update lead',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteLead(id: string, memberId: string) {
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`[LeadsService] No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const domain = await this.authService.getDomain(memberId);
    this.validateDomain(domain);

    try {
      const response = await this.limiter.schedule(() =>
        firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.delete`,
            { id },
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        ),
      );

      const data = response.data;
      if (data.error) {
        this.logger.error(
          `[LeadsService] Delete lead error: ${data.error_description}`,
        );
        throw new HttpException(data.error_description, HttpStatus.BAD_REQUEST);
      }

      this.logger.info(`[LeadsService] Lead ${id} deleted`);

      await this.redisService.deleteByPrefix(`leads:*:${memberId}`);

      return data;
    } catch (error) {
      this.logger.error(`Failed to delete lead: ${error.message}`);
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to delete lead',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildFilterParams(query: QueryLeadDto): string[] {
    const filterParams: string[] = [];

    if (query.search) {
      filterParams.push(
        `filter[%TITLE]=${encodeURIComponent(query.search)}`,
        `filter[%NAME]=${encodeURIComponent(query.search)}`,
        `filter[%EMAIL]=${encodeURIComponent(query.search)}`,
        `filter[%PHONE]=${encodeURIComponent(query.search)}`,
      );
    }
    if (query.status) {
      filterParams.push(
        `filter[STATUS_ID]=${encodeURIComponent(query.status)}`,
      );
    }
    if (query.source) {
      filterParams.push(
        `filter[SOURCE_ID]=${encodeURIComponent(query.source)}`,
      );
    }
    if (query.date) {
      filterParams.push(
        `filter[>DATE_CREATE]=${encodeURIComponent(query.date)}`,
      );
    }

    return filterParams;
  }

  private validateDomain(domain: string | undefined) {
    if (!domain || !domain.endsWith('.bitrix24.vn')) {
      this.logger.error(`Invalid domain: ${domain}`);
      throw new HttpException('Invalid domain', HttpStatus.BAD_REQUEST);
    }
  }

  private buildCacheKey(memberId: string, query: QueryLeadDto): string {
    const relevantQuery = {
      search: query.search,
      status: query.status,
      source: query.source,
      date: query.date,
      sort: query.sort,
    };
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(relevantQuery))
      .digest('hex');

    return `leads:${memberId}:${hash}`;
  }
}
