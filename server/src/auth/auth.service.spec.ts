import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: HttpService;
  let configService: ConfigService;
  let redisService: RedisService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BITRIX24_CLIENT_ID') {
        return 'mockClientId';
      }
      if (key === 'BITRIX24_CLIENT_SECRET') {
        return 'mockClientSecret';
      }
      if (key === 'BITRIX24_OAUTH_ENDPOINT') {
        return 'https://oauth.bitrix.info';
      }

      return null;
    }),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAuthUrl', () => {
    it('should generate the correct Bitrix24 authorization URL', () => {
      const domain = 'test.bitrix24.com';
      const expectedClientId = 'mockClientId';
      const authUrl = service.generateAuthUrl(domain);

      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(authUrl).toContain(
        `https://${domain}/oauth/authorize?client_id=${expectedClientId}&state=`,
      );
      expect(authUrl).toMatch(/&state=\d+$/);
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate the correct Bitrix24 authorization URL', () => {
      const domain = 'test.bitrix24.com';
      const expectedClientId = 'mockClientId';
      const authUrl = service.generateAuthUrl(domain);

      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(authUrl).toContain(
        `https://${domain}/oauth/authorize?client_id=${expectedClientId}&state=`,
      );
      expect(authUrl).toMatch(/&state=\d+$/);
    });
  });

  describe('exchangeCodeForToken', () => {
    const mockCode = 'mockCode123';
    const mockDomain = 'test.bitrix24.com';
    const mockTokenResponse = {
      access_token: 'newAccessToken',
      refresh_token: 'newRefreshToken',
      expires_in: 3600,
      member_id: 'mockMemberId',
      scope: 'crm,tasks',
    };

    it('should exchange code for token and store it in Redis', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockTokenResponse } as AxiosResponse),
      );

      const result = await service.exchangeCodeForToken(mockCode, mockDomain);

      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_OAUTH_ENDPOINT'); // Check for this call

      const expectedUrl = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=mockClientId&client_secret=mockClientSecret&code=${mockCode}`;
      expect(httpService.post).toHaveBeenCalledWith(expectedUrl);

      const expectedRedisKey = `token:${mockTokenResponse.member_id}`;
      const expectedRedisValue = JSON.stringify({
        access_token: mockTokenResponse.access_token,
        refresh_token: mockTokenResponse.refresh_token,
        expires_in: mockTokenResponse.expires_in,
        domain: mockDomain,
      });
      expect(redisService.set).toHaveBeenCalledWith(
        expectedRedisKey,
        expectedRedisValue,
        mockTokenResponse.expires_in,
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should throw an error if HTTP request fails', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.exchangeCodeForToken(mockCode, mockDomain),
      ).rejects.toThrow('Network error');
    });
  });

  describe('getAccessToken', () => {
    const mockMemberId = 'mockMemberId';
    const mockCachedTokenData = {
      access_token: 'cachedAccessToken',
      refresh_token: 'cachedRefreshToken',
      expires_in: 3600,
      domain: 'test.bitrix24.com',
    };

    it('should return access token if found in Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(
        JSON.stringify(mockCachedTokenData),
      );

      const result = await service.getAccessToken(mockMemberId); // <-- Truyền memberId

      expect(redisService.get).toHaveBeenCalledWith(`token:${mockMemberId}`);
      expect(result).toBe(mockCachedTokenData.access_token);
    });

    it('should return null if no token found in Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      const result = await service.getAccessToken(mockMemberId); // <-- Truyền memberId

      expect(redisService.get).toHaveBeenCalledWith(`token:${mockMemberId}`);
      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshToken = 'oldRefreshToken';
    const mockMemberId = 'mockMemberId';
    const mockRefreshedTokenResponse = {
      access_token: 'refreshedAccessToken',
      refresh_token: 'newRefreshedToken',
      expires_in: 7200,
      member_id: 'mockMemberId',
      scope: 'crm,tasks',
    };

    it('should refresh access token and update it in Redis', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockRefreshedTokenResponse } as AxiosResponse),
      );

      const result = await service.refreshAccessToken(
        mockRefreshToken,
        mockMemberId,
      );

      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_OAUTH_ENDPOINT'); // Check for this call

      const expectedUrl = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=mockClientId&client_secret=mockClientSecret&refresh_token=${mockRefreshToken}`;
      expect(httpService.post).toHaveBeenCalledWith(expectedUrl);

      const expectedRedisKey = `token:${mockMemberId}`;
      const expectedRedisValue = JSON.stringify({
        access_token: mockRefreshedTokenResponse.access_token,
        refresh_token: mockRefreshedTokenResponse.refresh_token,
        expires_in: mockRefreshedTokenResponse.expires_in,
      });
      expect(redisService.set).toHaveBeenCalledWith(
        expectedRedisKey,
        expectedRedisValue,
        mockRefreshedTokenResponse.expires_in,
      );

      expect(result).toBe(mockRefreshedTokenResponse.access_token);
    });

    it('should throw an error if HTTP request fails during refresh', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Refresh network error')),
      );

      await expect(
        service.refreshAccessToken(mockRefreshToken, mockMemberId),
      ).rejects.toThrow('Refresh network error');
    });
  });

  describe('getDomain', () => {
    const mockMemberId = 'mockMemberId';
    const mockTokenDataWithDomain = {
      access_token: 'someToken',
      refresh_token: 'someRefreshToken',
      expires_in: 3600,
      domain: 'test.bitrix24.com',
    };

    it('should return the domain if token data exists in Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(
        JSON.stringify(mockTokenDataWithDomain),
      );

      const result = await service.getDomain(mockMemberId);

      expect(redisService.get).toHaveBeenCalledWith(`token:${mockMemberId}`);
      expect(result).toBe(mockTokenDataWithDomain.domain);
    });

    it('should throw UnauthorizedException if no token data found in Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      await expect(service.getDomain(mockMemberId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getDomain(mockMemberId)).rejects.toThrow(
        'No token data in Redis',
      );
    });
  });
});
