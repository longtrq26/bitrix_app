import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as qs from 'qs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { buildCacheKey } from 'src/common/utils/build-cache-key';
import { RedisService } from 'src/redis/redis.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
  ) {}

  async getLeads(dto: QueryLeadDto, memberId: string) {
    const domain = dto.domain || (await this.authService.getDomain(memberId));
    this.validateDomain(domain);

    const cacheKey = buildCacheKey(memberId, dto);
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.logger.log(`Cache hit for leads: ${cacheKey}`);
        return parsed;
      } catch (error) {
        this.logger.warn(
          `Failed to parse cached leads for key: ${cacheKey}, deleting cache`,
        );
        await this.redisService.del(cacheKey);
      }
    }

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.error(`No access token for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const url = `https://${domain}/rest/batch`;
    const cmd = this.buildLeadBatchQuery(dto);

    const fetchLeads = async (token: string) => {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { halt: 0, cmd },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      this.logger.debug(
        `Batch response: ${JSON.stringify(response.data, null, 2)}`,
      );

      const data = response.data?.result?.result || {};
      const error = response.data?.result?.error;

      if (error) {
        this.logger.error(`Batch API error: ${JSON.stringify(error)}`);
        throw new HttpException(
          error?.leads?.error_description || 'Failed to fetch leads',
          error?.leads?.error || 500,
        );
      }

      return {
        leads: data?.leads || [],
        fields: data?.fields || {},
        statuses: data?.statuses || [],
        sources: data?.sources || [],
      };
    };

    try {
      const response = await fetchLeads(accessToken);
      await this.redisService.set(cacheKey, JSON.stringify(response), 600);
      this.logger.log(`Fetched and cached leads for memberId: ${memberId}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to fetch leads: ${error.message}`, error.stack);
      if (error.response?.status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await fetchLeads(newToken);
        await this.redisService.set(
          cacheKey,
          JSON.stringify(retryResponse),
          600,
        );
        this.logger.log(
          `Fetched and cached leads after retry for memberId: ${memberId}`,
        );
        return retryResponse;
      }
      throw new HttpException(
        error.response?.data?.error_description ||
          error.message ||
          'Failed to fetch leads',
        error.response?.status || 500,
      );
    }
  }

  async getLead(id: string, memberId: string) {
    const leadId = Number(id);
    if (isNaN(leadId) || leadId <= 0) {
      this.logger.error(`Invalid lead ID: ${id}`);
      throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
    }

    const domain = await this.authService.getDomain(memberId);
    this.validateDomain(domain);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.error(`No access token for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const cacheKey = `lead:${memberId}:${leadId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.logger.log(`Cache hit for lead: ${cacheKey}`);
        return parsed;
      } catch (error) {
        this.logger.warn(
          `Failed to parse cached lead for key: ${cacheKey}, deleting cache`,
        );
        await this.redisService.del(cacheKey);
      }
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://${domain}/rest/crm.lead.get?id=${leadId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );

      const lead = response.data.result || {};
      await this.redisService.set(cacheKey, JSON.stringify(lead), 600);
      this.logger.log(
        `Fetched and cached lead ${leadId} for memberId: ${memberId}`,
      );
      return lead;
    } catch (error) {
      this.logger.error(
        `Failed to fetch lead ${leadId}: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await firstValueFrom(
          this.httpService.get(
            `https://${domain}/rest/crm.lead.get?id=${leadId}`,
            { headers: { Authorization: `Bearer ${newToken}` } },
          ),
        );
        const lead = retryResponse.data.result || {};
        await this.redisService.set(cacheKey, JSON.stringify(lead), 600);
        this.logger.log(
          `Fetched and cached lead ${leadId} after retry for memberId: ${memberId}`,
        );
        return lead;
      }
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to fetch lead',
        error.response?.status || 500,
      );
    }
  }

  async createLead(dto: CreateLeadDto, memberId: string) {
    const domain = dto.domain || (await this.authService.getDomain(memberId));
    this.validateDomain(domain);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.error(`No access token for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const payload = {
      fields: {
        TITLE: dto.TITLE,
        NAME: dto.NAME,
        STATUS_ID: dto.STATUS_ID,
        SOURCE_ID: dto.SOURCE_ID,
        COMMENTS: dto.COMMENTS,
        ...(dto.EMAIL && { EMAIL: [{ VALUE: dto.EMAIL, VALUE_TYPE: 'WORK' }] }),
        ...(dto.PHONE && { PHONE: [{ VALUE: dto.PHONE, VALUE_TYPE: 'WORK' }] }),
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`https://${domain}/rest/crm.lead.add`, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      this.logger.log(`Lead created successfully: ${response.data.result}`);
      await this.redisService.delByPrefix(`leads:${memberId}`);
      return response.data.result;
    } catch (error) {
      this.logger.error(`Failed to create lead: ${error.message}`, error.stack);
      if (error.response?.status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.add`,
            payload,
            {
              headers: { Authorization: `Bearer ${newToken}` },
            },
          ),
        );
        this.logger.log(
          `Lead created successfully after retry: ${retryResponse.data.result}`,
        );
        await this.redisService.delByPrefix(`leads:${memberId}`);
        return retryResponse.data.result;
      }
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to create lead',
        error.response?.status || 500,
      );
    }
  }

  async updateLead(id: string, dto: UpdateLeadDto, memberId: string) {
    const domain = dto.domain || (await this.authService.getDomain(memberId));
    this.validateDomain(domain);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.error(`No access token for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const payload = {
      fields: {
        ...(dto.TITLE && { TITLE: dto.TITLE }),
        ...(dto.NAME && { NAME: dto.NAME }),
        ...(dto.STATUS_ID && { STATUS_ID: dto.STATUS_ID }),
        ...(dto.SOURCE_ID && { SOURCE_ID: dto.SOURCE_ID }),
        ...(dto.COMMENTS && { COMMENTS: dto.COMMENTS }),
        ...(dto.EMAIL && { EMAIL: [{ VALUE: dto.EMAIL, VALUE_TYPE: 'WORK' }] }),
        ...(dto.PHONE && { PHONE: [{ VALUE: dto.PHONE, VALUE_TYPE: 'WORK' }] }),
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://${domain}/rest/crm.lead.update?id=${id}`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );

      this.logger.log(`Lead updated successfully: ${id}`);
      await this.redisService.delByPrefix(`leads:${memberId}`);
      return response.data.result;
    } catch (error) {
      this.logger.error(`Failed to update lead: ${error.message}`, error.stack);
      if (error.response?.status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await firstValueFrom(
          this.httpService.post(
            `https://${domain}/rest/crm.lead.update?id=${id}`,
            payload,
            { headers: { Authorization: `Bearer ${newToken}` } },
          ),
        );
        this.logger.log(`Lead updated successfully after retry: ${id}`);
        await this.redisService.delByPrefix(`leads:${memberId}`);
        return retryResponse.data.result;
      }
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to update lead',
        error.response?.status || 500,
      );
    }
  }

  async deleteLead(id: string, memberId: string) {
    const leadId = Number(id);
    if (isNaN(leadId) || leadId <= 0) {
      this.logger.error(`Invalid lead ID: ${id}`);
      throw new HttpException('Invalid lead ID', HttpStatus.BAD_REQUEST);
    }

    const domain = await this.authService.getDomain(memberId);
    this.validateDomain(domain);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.error(`No access token for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const deleteUrl = `https://${domain}/rest/crm.lead.delete?id=${leadId}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          deleteUrl,
          {},
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );

      this.logger.log(`Lead deleted successfully: ${leadId}`);
      await this.redisService.delByPrefix(`leads:${memberId}`);
      return response.data.result;
    } catch (error) {
      const status = error.response?.status || 500;
      const bitrixError = error.response?.data;

      this.logger.error(`Failed to delete lead`, {
        leadId,
        status,
        bitrixError,
      });

      if (status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await firstValueFrom(
          this.httpService.post(
            deleteUrl,
            {},
            {
              headers: { Authorization: `Bearer ${newToken}` },
            },
          ),
        );
        this.logger.log(`Lead deleted successfully after retry: ${leadId}`);
        await this.redisService.delByPrefix(`leads:${memberId}`);
        return retryResponse.data.result;
      }

      throw new HttpException(
        bitrixError?.error_description || 'Failed to delete lead',
        status,
      );
    }
  }

  async getLeadTasks(id: string, memberId: string) {
    const domain = await this.authService.getDomain(memberId);
    this.validateDomain(domain);
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken)
      throw new UnauthorizedException('Access token not available.');
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://${domain}/rest/tasks.task.list?filter[LEAD_ID]=${id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      this.logger.debug(
        `Tasks response for lead ${id}: ${JSON.stringify(response.data)}`,
      );
      return (
        response.data.result.tasks?.map((task) => ({
          ID: task.id || 'N/A',
          TITLE: task.title || 'N/A',
          STATUS: task.status || 'N/A',
        })) || []
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch tasks for lead ${id}: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await firstValueFrom(
          this.httpService.get(
            `https://${domain}/rest/tasks.task.list?filter[LEAD_ID]=${id}`,
            { headers: { Authorization: `Bearer ${newToken}` } },
          ),
        );
        this.logger.debug(
          `Retry tasks response for lead ${id}: ${JSON.stringify(retryResponse.data)}`,
        );
        return (
          retryResponse.data.result.tasks?.map((task) => ({
            ID: task.id || 'N/A',
            TITLE: task.title || 'N/A',
            STATUS: task.status || 'N/A',
          })) || []
        );
      }
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to fetch tasks',
        error.response?.status || 500,
      );
    }
  }

  async getLeadDeals(id: string, memberId: string) {
    const domain = await this.authService.getDomain(memberId);
    this.validateDomain(domain);
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken)
      throw new UnauthorizedException('Access token not available.');
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://${domain}/rest/crm.deal.list?filter[LEAD_ID]=${id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      this.logger.debug(
        `Deals response for lead ${id}: ${JSON.stringify(response.data)}`,
      );
      return (
        response.data.result?.map((deal) => ({
          ID: deal.id || deal.ID || 'N/A',
          TITLE: deal.title || deal.TITLE || 'N/A',
          OPPORTUNITY: deal.opportunity || deal.OPPORTUNITY || 'N/A',
        })) || []
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch deals for lead ${id}: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 401) {
        const newToken = await this.authService.refreshToken(memberId);
        const retryResponse = await firstValueFrom(
          this.httpService.get(
            `https://${domain}/rest/crm.deal.list?filter[LEAD_ID]=${id}`,
            { headers: { Authorization: `Bearer ${newToken}` } },
          ),
        );
        this.logger.debug(
          `Retry deals response for lead ${id}: ${JSON.stringify(retryResponse.data)}`,
        );
        return (
          retryResponse.data.result?.map((deal) => ({
            ID: deal.id || deal.ID || 'N/A',
            TITLE: deal.title || deal.TITLE || 'N/A',
            OPPORTUNITY: deal.opportunity || deal.OPPORTUNITY || 'N/A',
          })) || []
        );
      }
      throw new HttpException(
        error.response?.data?.error_description || 'Failed to fetch deals',
        error.response?.status || 500,
      );
    }
  }

  private validateDomain(domain: string | undefined) {
    if (!domain || !domain.endsWith('.bitrix24.vn')) {
      this.logger.error(`Invalid domain: ${domain}`);
      throw new HttpException('Invalid domain', HttpStatus.BAD_REQUEST);
    }
  }

  private buildLeadBatchQuery(dto: QueryLeadDto) {
    const filter: Record<string, any> = {};
    const order: Record<string, string> = {};

    if (dto.find) filter['%TITLE'] = dto.find;
    if (dto.status) filter['STATUS_ID'] = dto.status;
    if (dto.source) filter['SOURCE_ID'] = dto.source;
    if (dto.date) filter['>=DATE_CREATE'] = dto.date;

    const sortField = dto.sort || 'DATE_CREATE';
    order[sortField] = 'DESC';

    const query = qs.stringify(
      { filter, order },
      {
        encode: false,
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
