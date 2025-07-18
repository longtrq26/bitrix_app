import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import Bottleneck from 'bottleneck';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { Logger } from 'winston';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { buildCacheKey } from 'src/common/utils/build-cache-key';

export class BitrixApiException extends HttpException {
  constructor(error: any) {
    super(
      error?.error_description || 'Bitrix24 API error',
      error?.status || HttpStatus.BAD_REQUEST,
    );
  }
}

@Injectable()
export class LeadsService {
  private readonly limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 500,
    retryOptions: {
      maxRetries: 5,
      delay: (retryCount) => Math.pow(2, retryCount) * 1000,
      retryableErrors: [429, 503],
    },
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
    private readonly amqpConnection: AmqpConnection,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Lấy danh sách các lead từ Bitrix24
  async getLeads(dto: QueryLeadDto, memberId: string) {
    // Xác thực domain
    this.validateDomain(dto.domain);

    // Xây dựng cache key dựa trên memberId và các query params
    const cacheKey = buildCacheKey(memberId, dto);
    // Lấy data từ cache Redis
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Lấy access token từ AuthService
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    // Endpoint cho yêu cầu batch của Bitrix24
    const endpoint = `https://${dto.domain}/rest/batch`;

    // Các query params
    const queryParams = this.buildQueryParams(dto);
    // Xác định sort field
    const sortField = dto.sort || 'DATE_CREATE';
    // sort param
    const sortParam = `order[${sortField}]=DESC`;
    // Kết hợp các params từ query và sort
    const paramString = [...queryParams, sortParam].join('&');

    // Các lệnh batch gửi đến Bitrix24 API
    const cmd = {
      // Lấy lead list
      leads: paramString ? `crm.lead.list?${paramString}` : `crm.lead.list`,
      // Lấy các fields có sẵn của lead
      fields: 'crm.lead.fields',
      // Lấy status list
      statuses: 'crm.status.list?filter[ENTITY_ID]=STATUS',
      // Lấy source list
      sources: 'crm.status.list?filter[ENTITY_ID]=SOURCE',
    };

    try {
      // yêu cầu POST đến Bitrix24 API
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
        throw new BitrixApiException(data);
      }

      // Trích xuất data từ response
      const leads = data?.result?.result?.leads || [];
      const fields = data?.result?.result?.fields || {};
      const statuses = data?.result?.result?.statuses || [];
      const sources = data?.result?.result?.sources || [];
      const result = { leads, fields, statuses, sources };

      if (leads.length === 0) {
        this.logger.warn(`No leads found`);
      } else {
        this.logger.info(`${leads.length} leads fetched`);
      }

      // Đặt TTL cho cache
      const ttl = leads.length > 0 ? 300 : 600;

      // Lưu kết quả vào cache
      await this.redisService.set(cacheKey, JSON.stringify(result), ttl);

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch leads: ${error.message}`);
      throw new BitrixApiException(error);
    }
  }

  // Tạo một lead mới trong Bitrix24
  async createLead(dto: CreateLeadDto, memberId: string) {
    // Xác thực domain
    this.validateDomain(dto.domain);

    // Lấy access token
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    // Tách domain và customFields khỏi DTO
    const { domain, customFields, ...rest } = dto;
    // Kết hợp các fields mặc định và custom fields
    const fields = { ...rest, ...(customFields || {}) };

    try {
      // yêu cầu POST để tạo lead mới
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
        throw new BitrixApiException(data);
      }

      this.logger.info(`Lead created: ${data.result}`);

      // Xóa tất cả các cache keys liên quan đến leads của member để đảm bảo data mới nhất
      await this.redisService.deleteByPrefix(`leads:${memberId}:`);
      // Publish lead.created lên RabbitMQ
      await this.amqpConnection.publish('leads_exchange', 'lead.created', {
        leadId: data.result,
        memberId,
        domain: dto.domain,
      });

      return data;
    } catch (error) {
      this.logger.error(`Failed to create lead: ${error.message}`);
      throw new BitrixApiException(error);
    }
  }

  // Cập nhật lead hiện có trong Bitrix24
  async updateLead(id: string, dto: UpdateLeadDto, memberId: string) {
    // Xác thực domain
    this.validateDomain(dto.domain);

    // Lấy access token
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    // Tách domain và customFields khỏi DTO
    const { domain, customFields, ...rest } = dto;
    // Kết hợp các fields mặc định và custom fields
    const fields = { ...rest, ...(customFields || {}) };

    try {
      // Yêu cầu POST để cập nhật lead
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
        throw new BitrixApiException(data);
      }

      this.logger.info(`Lead ${id} updated`);

      // Xóa tất cả các cache keys liên quan đến leads của member để đảm bảo data mới nhất
      await this.redisService.deleteByPrefix(`leads:${memberId}:`);
      // Publish lead.updated lên RabbitMQ.
      await this.amqpConnection.publish('leads_exchange', 'lead.updated', {
        leadId: id,
        memberId,
        domain: dto.domain,
      });

      return data;
    } catch (error) {
      this.logger.error(`Failed to update lead: ${error.message}`);
      throw new BitrixApiException(error);
    }
  }

  // Xóa lead hiện có trong Bitrix24
  async deleteLead(id: string, memberId: string) {
    // Lấy access token
    const accessToken = await this.authService.getAccessToken(memberId);
    if (!accessToken) {
      this.logger.warn(`No access token for ${memberId}`);
      throw new UnauthorizedException('Access token not available.');
    }

    // Lấy domain từ AuthService
    const domain = await this.authService.getDomain(memberId);
    // Xác thực domain
    this.validateDomain(domain);

    try {
      // Yêu cầu POST để xóa lead
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
        throw new BitrixApiException(data);
      }

      this.logger.info(`Lead ${id} deleted`);

      // Xóa tất cả các cache keys liên quan đến leads của member để đảm bảo data mới nhất
      await this.redisService.deleteByPrefix(`leads:${memberId}:`);
      // Publish lead.deleted lên RabbitMQ.
      await this.amqpConnection.publish('leads_exchange', 'lead.deleted', {
        leadId: id,
        memberId,
        domain,
      });

      return data;
    } catch (error) {
      this.logger.error(`Failed to delete lead: ${error.message}`);
      throw new BitrixApiException(error);
    }
  }

  // Xây dựng các query params cho API Bitrix24
  private buildQueryParams(query: QueryLeadDto): string[] {
    const filterParams: string[] = [];

    if (query.find) {
      filterParams.push(
        `filter[TITLE]=${query.find}`,
        `filter[NAME]=${query.find}`,
        `filter[EMAIL]=${query.find}`,
        `filter[PHONE]=${query.find}`,
      );
    }
    if (query.status) {
      filterParams.push(`filter[STATUS_ID]=${query.status}`);
    }
    if (query.source) {
      filterParams.push(`filter[SOURCE_ID]=${query.source}`);
    }
    if (query.date) {
      filterParams.push(`filter[>DATE_CREATE]=${query.date}`);
    }

    return filterParams;
  }

  // Xác thực domain
  private validateDomain(domain: string | undefined) {
    if (!domain || !domain.endsWith('.bitrix24.vn')) {
      this.logger.error(`Invalid domain: ${domain}`);
      throw new HttpException('Invalid domain', HttpStatus.BAD_REQUEST);
    }
  }
}
