import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private limiter = new Bottleneck({ minTime: 500 });

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
  ) {}

  async getLeads(query: QueryLeadDto, memberId: string) {
    const cacheKey = `leads:${JSON.stringify(query)}:${memberId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`Access token not found for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const endpoint = `https://${query.domain}/rest/batch`;

    const filterParams: string[] = [];
    if (query.search)
      filterParams.push(`filter[%TITLE]=${encodeURIComponent(query.search)}`);
    if (query.status)
      filterParams.push(
        `filter[STATUS_ID]=${encodeURIComponent(query.status)}`,
      );
    if (query.source)
      filterParams.push(
        `filter[SOURCE_ID]=${encodeURIComponent(query.source)}`,
      );

    const sortField = query.sort || 'DATE_CREATE';
    const sortParam = `order[${sortField}]=DESC`;

    const paramString = [...filterParams, sortParam].join('&');
    const listCommand = paramString
      ? `crm.lead.list?${paramString}`
      : `crm.lead.list`;

    const cmd = {
      leads: listCommand,
      fields: 'crm.lead.fields',
    };

    this.logger.debug(`Batch CMD`, cmd);

    const response = await this.limiter.schedule(() =>
      firstValueFrom(
        this.httpService.post(
          endpoint,
          { halt: 0, cmd },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      ),
    );

    const data = response.data;

    const leads = data?.result?.result?.leads;

    if (!leads || leads.length === 0) {
      this.logger.warn('No leads found or unexpected Bitrix24 response');
    } else {
      this.logger.log(`Fetched ${leads.length} leads from Bitrix24`);
    }

    await this.redisService.set(cacheKey, JSON.stringify(leads), 600);

    return leads;
  }

  async createLead(dto: CreateLeadDto, memberId: string) {
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`Access token not found for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const response = await this.limiter.schedule(() =>
      firstValueFrom(
        this.httpService.post(
          `https://${dto.domain}/rest/crm.lead.add`,
          {
            fields: dto,
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      ),
    );

    const data = response.data;

    this.logger.log('Created lead successfully');

    await this.redisService.deleteByPrefix(`leads:*:${memberId}`);

    return data;
  }

  async updateLead(id: string, dto: UpdateLeadDto, memberId: string) {
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`Access token not found for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const response = await this.limiter.schedule(() =>
      firstValueFrom(
        this.httpService.post(
          `https://${dto.domain}/rest/crm.lead.update`,
          {
            id,
            fields: dto,
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      ),
    );

    const data = response.data;

    this.logger.log(`Updated lead ID ${id}`);

    await this.redisService.deleteByPrefix(`leads:*:${memberId}`);

    return data;
  }

  async deleteLead(id: string, memberId: string) {
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`Access token not found for memberId: ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    const domain = await this.authService.getDomain(memberId);
    if (!domain) {
      this.logger.warn(`Domain not found for memberId: ${memberId}`);
      throw new UnauthorizedException('Domain not available.');
    }

    const response = await this.limiter.schedule(() =>
      firstValueFrom(
        this.httpService.post(
          `https://${domain}/rest/crm.lead.delete`,
          {
            id,
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      ),
    );

    const data = response.data;

    this.logger.log(`Deleted lead ID ${id}`);

    await this.redisService.deleteByPrefix(`leads:*:${memberId}`);

    return data;
  }
}
