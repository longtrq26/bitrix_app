import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { LeadsService } from './leads.service';

class MockQueryLeadDto {
  search?: string;
  status?: string;
  source?: string;
  sort?: string;
  domain?: string;
}

class MockCreateLeadDto {
  TITLE: string;
  EMAIL?: string;
  PHONE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  COMMENTS?: string;
  domain: string;
}

class MockUpdateLeadDto {
  TITLE?: string;
  EMAIL?: string;
  PHONE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  COMMENTS?: string;
  domain: string;
}

describe('LeadService', () => {
  let service: LeadsService;
  let httpService: HttpService;
  let redisService: RedisService;
  let authService: AuthService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    deleteByPrefix: jest.fn(),
  };

  const mockAuthService = {
    getAccessToken: jest.fn(),
    getDomain: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    httpService = module.get<HttpService>(HttpService);
    redisService = module.get<RedisService>(RedisService);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();

    jest
      .spyOn((service as any).limiter, 'schedule')
      .mockImplementation(async (cb: () => Promise<any>) => cb());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLeads', () => {
    const memberId = 'testMemberId';
    const mockAccessToken = 'mockAccessToken123';
    const mockLeadsData = [{ ID: '1', TITLE: 'Test Lead' }];
    const mockQuery: MockQueryLeadDto = { domain: 'test.bitrix24.com' };
    const cacheKey = `leads:${JSON.stringify(mockQuery)}:${memberId}`;

    it('should return cached leads if available in Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(mockLeadsData));

      const result = await service.getLeads(mockQuery, memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(mockLeadsData);
      expect(authService.getAccessToken).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch leads from Bitrix24, cache them, and return them if no cache', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: { result: { result: { leads: mockLeadsData } } },
        } as AxiosResponse),
      );

      const result = await service.getLeads(mockQuery, memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${mockQuery.domain}/rest/batch`,
        {
          halt: 0,
          cmd: {
            leads: 'crm.lead.list?order[DATE_CREATE]=DESC',
            fields: 'crm.lead.fields',
          },
        },
        { headers: { Authorization: `Bearer ${mockAccessToken}` } },
      );
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(mockLeadsData),
        600,
      );
      expect(result).toEqual(mockLeadsData);
    });

    it('should correctly build query parameters for search, status, and source', async () => {
      const complexQuery: MockQueryLeadDto = {
        domain: 'test.bitrix24.com',
        search: 'Awesome Lead',
        status: 'NEW',
        source: 'WEB',
        sort: 'TITLE',
      };
      const complexCacheKey = `leads:${JSON.stringify(complexQuery)}:${memberId}`;

      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: { result: { result: { leads: mockLeadsData } } },
        } as AxiosResponse),
      );

      await service.getLeads(complexQuery, memberId);

      const expectedListCommand = `crm.lead.list?filter[%TITLE]=Awesome%20Lead&filter[STATUS_ID]=NEW&filter[SOURCE_ID]=WEB&order[TITLE]=DESC`;
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${complexQuery.domain}/rest/batch`,
        {
          halt: 0,
          cmd: { leads: expectedListCommand, fields: 'crm.lead.fields' },
        },
        { headers: { Authorization: `Bearer ${mockAccessToken}` } },
      );
      expect(redisService.set).toHaveBeenCalledWith(
        complexCacheKey,
        JSON.stringify(mockLeadsData),
        600,
      );
    });

    it('should return empty array if no leads found in Bitrix24 response', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: { result: { result: { leads: [] } } },
        } as AxiosResponse),
      );

      const result = await service.getLeads(mockQuery, memberId);

      expect(result).toEqual([]);
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify([]),
        600,
      );
    });

    it('should return empty array if Bitrix24 response is malformed or missing leads', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: { result: {} },
        } as AxiosResponse),
      );

      const result = await service.getLeads(mockQuery, memberId);

      expect(result).toEqual(undefined);
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(undefined),
        600,
      );
    });

    it('should throw an error if getting access token fails', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);

      await expect(service.getLeads(mockQuery, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(httpService.post).not.toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should throw an error if HTTP request fails', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Network error during leads fetch')),
      );

      await expect(service.getLeads(mockQuery, memberId)).rejects.toThrow(
        'Network error during leads fetch',
      );
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('createLead', () => {
    const memberId = 'testMemberId';
    const mockAccessToken = 'mockAccessToken123';
    const mockCreateDto: MockCreateLeadDto = {
      domain: 'test.bitrix24.com',
      TITLE: 'New Lead',
    };
    const mockBitrixResponse = { result: 123 };

    it('should create a lead and delete relevant cache', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockBitrixResponse } as AxiosResponse),
      );

      const result = await service.createLead(mockCreateDto, memberId);

      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${mockCreateDto.domain}/rest/crm.lead.add`,
        { fields: mockCreateDto },
        { headers: { Authorization: `Bearer ${mockAccessToken}` } },
      );
      expect(redisService.deleteByPrefix).toHaveBeenCalledWith(
        `leads:*:${memberId}`,
      );
      expect(result).toEqual(mockBitrixResponse);
    });

    it('should throw an error if getting access token fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);

      await expect(service.createLead(mockCreateDto, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(httpService.post).not.toHaveBeenCalled();
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });

    it('should throw an error if HTTP request fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Network error during lead creation')),
      );

      await expect(service.createLead(mockCreateDto, memberId)).rejects.toThrow(
        'Network error during lead creation',
      );
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });
  });

  describe('updateLead', () => {
    const memberId = 'testMemberId';
    const leadId = '456';
    const mockAccessToken = 'mockAccessToken123';
    const mockUpdateDto: MockUpdateLeadDto = {
      domain: 'test.bitrix24.com',
      STATUS_ID: 'CLOSED_WON',
    };
    const mockBitrixResponse = { result: true };

    it('should update a lead and delete relevant cache', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockBitrixResponse } as AxiosResponse),
      );

      const result = await service.updateLead(leadId, mockUpdateDto, memberId);

      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${mockUpdateDto.domain}/rest/crm.lead.update`,
        { id: leadId, fields: mockUpdateDto },
        { headers: { Authorization: `Bearer ${mockAccessToken}` } },
      );
      expect(redisService.deleteByPrefix).toHaveBeenCalledWith(
        `leads:*:${memberId}`,
      );
      expect(result).toEqual(mockBitrixResponse);
    });

    it('should throw an error if getting access token fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);

      await expect(
        service.updateLead(leadId, mockUpdateDto, memberId),
      ).rejects.toThrow(UnauthorizedException);
      expect(httpService.post).not.toHaveBeenCalled();
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });

    it('should throw an error if HTTP request fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Network error during lead update')),
      );

      await expect(
        service.updateLead(leadId, mockUpdateDto, memberId),
      ).rejects.toThrow('Network error during lead update');
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });
  });

  describe('deleteLead', () => {
    const memberId = 'testMemberId';
    const leadId = '789';
    const mockAccessToken = 'mockAccessToken123';
    const mockDomain = 'test.bitrix24.com';
    const mockBitrixResponse = { result: true };

    it('should delete a lead and delete relevant cache', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockAuthService.getDomain.mockResolvedValueOnce(mockDomain);
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockBitrixResponse } as AxiosResponse),
      );

      const result = await service.deleteLead(leadId, memberId);

      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${mockDomain}/rest/crm.lead.delete`,
        { id: leadId },
        { headers: { Authorization: `Bearer ${mockAccessToken}` } },
      );
      expect(redisService.deleteByPrefix).toHaveBeenCalledWith(
        `leads:*:${memberId}`,
      );
      expect(result).toEqual(mockBitrixResponse);
    });

    it('should throw an error if getting access token fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);

      await expect(service.deleteLead(leadId, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.getDomain).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });

    it('should throw an error if getting domain fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockAuthService.getDomain.mockRejectedValueOnce(
        new UnauthorizedException('No token data in Redis'),
      );

      await expect(service.deleteLead(leadId, memberId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(httpService.post).not.toHaveBeenCalled();
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });

    it('should throw an error if HTTP request fails', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(mockAccessToken);
      mockAuthService.getDomain.mockResolvedValueOnce(mockDomain);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Network error during lead deletion')),
      );

      await expect(service.deleteLead(leadId, memberId)).rejects.toThrow(
        'Network error during lead deletion',
      );
      expect(redisService.deleteByPrefix).not.toHaveBeenCalled();
    });
  });
});
