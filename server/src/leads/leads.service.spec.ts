import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { LeadsService, BitrixApiException } from './leads.service';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('LeadsService', () => {
  let service: LeadsService;
  const mockHttpService = { post: jest.fn() };
  const mockAuthService = {
    getAccessToken: jest.fn(),
    getDomain: jest.fn(),
  };
  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    deleteByPrefix: jest.fn(),
  };
  const mockAmqp = { publish: jest.fn() };
  const mockLogger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AmqpConnection, useValue: mockAmqp },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getLeads', () => {
    const query: QueryLeadDto = {
      domain: 'test.bitrix24.vn',
      find: 'test',
      status: 'NEW',
    };
    const memberId = 'user123';

    it('should return cached result if available', async () => {
      const cached = { leads: [], fields: {}, statuses: [], sources: [] };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getLeads(query, memberId);

      expect(mockRedisService.get).toHaveBeenCalledWith(expect.any(String));
      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('should throw if no access token found', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);

      await expect(service.getLeads(query, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `No access token for ${memberId}`,
      );
    });

    it('should fetch from API, cache result and return it', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce('token123');
      const apiData = {
        result: {
          result: {
            leads: [{ ID: 1 }],
            fields: { TITLE: 'text' },
            statuses: [{ ID: 'NEW' }],
            sources: [{ ID: 'WEB' }],
          },
        },
      };
      mockHttpService.post.mockReturnValueOnce(of({ data: apiData }));

      const result = await service.getLeads(query, memberId);

      expect(mockHttpService.post).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({
          leads: apiData.result.result.leads,
          fields: apiData.result.result.fields,
          statuses: apiData.result.result.statuses,
          sources: apiData.result.result.sources,
        }),
        300,
      );
      expect(result).toEqual({
        leads: apiData.result.result.leads,
        fields: apiData.result.result.fields,
        statuses: apiData.result.result.statuses,
        sources: apiData.result.result.sources,
      });
    });

    it('should throw BitrixApiException on API error', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce('token123');
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { error: 'error!' } }),
      );

      await expect(service.getLeads(query, memberId)).rejects.toThrow(
        BitrixApiException,
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw on invalid domain', async () => {
      const badQuery = { ...query, domain: 'invalid.com' };
      await expect(service.getLeads(badQuery, memberId)).rejects.toThrow(
        HttpException,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid domain: invalid.com',
      );
    });
  });

  describe('createLead', () => {
    const dto: CreateLeadDto = {
      domain: 'test.bitrix24.vn',
      TITLE: 'New',
      customFields: { UF_CUSTOM: 'ABC' },
    };
    const memberId = 'user123';

    it('should create lead and publish event', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce('token123');
      const response = { result: 'lead123' };
      mockHttpService.post.mockReturnValueOnce(of({ data: response }));

      const result = await service.createLead(dto, memberId);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${dto.domain}/rest/crm.lead.add`,
        { fields: { TITLE: 'New', UF_CUSTOM: 'ABC' } },
        expect.any(Object),
      );
      expect(mockRedisService.deleteByPrefix).toHaveBeenCalledWith(
        `leads:${memberId}:`,
      );
      expect(mockAmqp.publish).toHaveBeenCalledWith(
        'leads_exchange',
        'lead.created',
        { leadId: 'lead123', memberId, domain: dto.domain },
      );
      expect(result).toEqual(response);
    });

    it('should throw if no access token', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);

      await expect(service.createLead(dto, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw on API error', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce('token123');
      mockHttpService.post.mockReturnValueOnce(of({ data: { error: 'fail' } }));

      await expect(service.createLead(dto, memberId)).rejects.toThrow(
        BitrixApiException,
      );
    });
  });

  describe('updateLead', () => {
    const dto: UpdateLeadDto = {
      domain: 'test.bitrix24.vn',
      TITLE: 'Updated',
      customFields: { UF_X: 'YYY' },
    };
    const leadId = 'lead001';
    const memberId = 'user123';

    it('should update lead and publish event', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce('token123');
      const response = { result: true };
      mockHttpService.post.mockReturnValueOnce(of({ data: response }));

      const result = await service.updateLead(leadId, dto, memberId);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${dto.domain}/rest/crm.lead.update`,
        { id: leadId, fields: { TITLE: 'Updated', UF_X: 'YYY' } },
        expect.any(Object),
      );
      expect(mockRedisService.deleteByPrefix).toHaveBeenCalledWith(
        `leads:${memberId}:`,
      );
      expect(mockAmqp.publish).toHaveBeenCalledWith(
        'leads_exchange',
        'lead.updated',
        { leadId, memberId, domain: dto.domain },
      );
      expect(result).toEqual(response);
    });

    it('should throw if no token', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);
      await expect(service.updateLead(leadId, dto, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('deleteLead', () => {
    const memberId = 'user123';
    const domain = 'test.bitrix24.vn';
    const leadId = 'lead001';

    it('should delete lead and publish event', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce('token123');
      mockAuthService.getDomain.mockResolvedValueOnce(domain);
      const response = { result: true };
      mockHttpService.post.mockReturnValueOnce(of({ data: response }));

      const result = await service.deleteLead(leadId, memberId);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/crm.lead.delete`,
        { id: leadId },
        expect.any(Object),
      );
      expect(mockRedisService.deleteByPrefix).toHaveBeenCalledWith(
        `leads:${memberId}:`,
      );
      expect(mockAmqp.publish).toHaveBeenCalledWith(
        'leads_exchange',
        'lead.deleted',
        { leadId, memberId, domain },
      );
      expect(result).toEqual(response);
    });

    it('should throw if no access token', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);
      await expect(service.deleteLead(leadId, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
