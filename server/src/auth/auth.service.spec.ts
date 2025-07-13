import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { of, throwError } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let httpService: HttpService;
  let configService: ConfigService;
  let redisService: RedisService;
  let logger: any;

  const mockClientId = 'testClientId';
  const mockClientSecret = 'testClientSecret';
  const mockEncryptionKey = 'a'.repeat(64);

  const mockTokenData = {
    access_token: 'mockAccessToken',
    refresh_token: 'mockRefreshToken',
    expires_in: 3600,
    member_id: 'mockMemberId',
    domain: 'mockDomain.bitrix24.com',
  };

  const mockIv = 'b'.repeat(32);
  const mockEncryptedDataString = `${mockIv}:c`.repeat(32);

  beforeEach(async () => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue('mock-uuid-state');
    (crypto.randomBytes as jest.Mock).mockReturnValue(
      Buffer.from(mockIv, 'hex'),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'BITRIX24_CLIENT_ID') return mockClientId;
              if (key === 'BITRIX24_CLIENT_SECRET') return mockClientSecret;
              if (key === 'ENCRYPTION_KEY') return mockEncryptionKey;
              return null;
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
    logger = module.get(WINSTON_MODULE_PROVIDER);

    (service as any).encryptData = jest.fn(() => {
      configService.get('ENCRYPTION_KEY');
      return mockEncryptedDataString;
    });

    (service as any).decryptData = jest.fn(() => {
      configService.get('ENCRYPTION_KEY');
      return mockTokenData;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAuthUrl', () => {
    it('should generate a valid authorization URL and state', async () => {
      const domain = 'test.bitrix24.com';
      const { url, state } = await service.generateAuthUrl(domain);

      expect(url).toBe(
        `https://${domain}/oauth/authorize?client_id=${mockClientId}&state=mock-uuid-state`,
      );
      expect(state).toBe('mock-uuid-state');
      expect(uuidv4).toHaveBeenCalledTimes(1);
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(logger.info).toHaveBeenCalledWith(
        `Generated OAuth URL for domain: ${domain}`,
      );
    });
  });

  describe('storeState', () => {
    it('should store the state in Redis', async () => {
      const domain = 'test.bitrix24.com';
      const state = 'mock-state-123';
      await service.storeState(domain, state);

      expect(redisService.set).toHaveBeenCalledWith(
        `state:${domain}`,
        state,
        600,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `Stored state for domain: ${domain}`,
      );
    });
  });

  describe('getStoredState', () => {
    it('should retrieve the stored state from Redis', async () => {
      const domain = 'test.bitrix24.com';
      const storedState = 'mock-stored-state';
      (redisService.get as jest.Mock).mockResolvedValue(storedState);
      const result = await service.getStoredState(domain);

      expect(result).toBe(storedState);
      expect(redisService.get).toHaveBeenCalledWith(`state:${domain}`);
    });

    it('should return null if state is not found', async () => {
      const domain = 'test.bitrix24.com';
      (redisService.get as jest.Mock).mockResolvedValue(null);
      const result = await service.getStoredState(domain);

      expect(result).toBeNull();
    });
  });

  describe('exchangeCodeForToken', () => {
    const code = 'testCode';
    const domain = 'test.bitrix24.com';
    const expectedUrl = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${mockClientId}&client_secret=${mockClientSecret}&code=${code}`;

    it('should exchange code for token, encrypt, and store it', async () => {
      (httpService.post as jest.Mock).mockReturnValue(
        of({ data: mockTokenData }),
      );

      (service as any).encryptData = jest.fn(() => {
        configService.get('ENCRYPTION_KEY');
        return mockEncryptedDataString;
      });

      const result = await service.exchangeCodeForToken(code, domain);

      expect(httpService.post).toHaveBeenCalledWith(expectedUrl);
      expect((service as any).encryptData).toHaveBeenCalledWith({
        access_token: 'mockAccessToken',
        refresh_token: 'mockRefreshToken',
        expires_in: 3600,
        domain: 'test.bitrix24.com',
      });
      expect(redisService.set).toHaveBeenCalledWith(
        `token:${mockTokenData.member_id}`,
        mockEncryptedDataString,
        mockTokenData.expires_in,
      );
      expect(result).toEqual(mockTokenData);
      expect(logger.info).toHaveBeenCalledWith(
        `Requesting token for domain: ${domain}`,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Stored token in Redis for member_id: ${mockTokenData.member_id}`,
      );
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('should throw UnauthorizedException on API error', async () => {
      const errorMessage = 'Network error';
      (httpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error(errorMessage)),
      );

      await expect(service.exchangeCodeForToken(code, domain)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.exchangeCodeForToken(code, domain)).rejects.toThrow(
        `Failed to exchange code: ${errorMessage}`,
      );
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to exchange code for token: ${errorMessage}`,
      );
      expect((service as any).encryptData).not.toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('getAccessToken', () => {
    it('should return access token if found and decrypted', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(
        mockEncryptedDataString,
      );

      const result = await service.getAccessToken(mockTokenData.member_id);

      expect(result).toBe(mockTokenData.access_token);
      expect(redisService.get).toHaveBeenCalledWith(
        `token:${mockTokenData.member_id}`,
      );
      expect((service as any).decryptData).toHaveBeenCalledWith(
        mockEncryptedDataString,
      );
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('should return null if token not found in Redis', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.getAccessToken(mockTokenData.member_id);

      expect(result).toBeNull();
      expect(redisService.get).toHaveBeenCalledWith(
        `token:${mockTokenData.member_id}`,
      );
      expect((service as any).decryptData).not.toHaveBeenCalled();
    });

    it('should throw error if decryption fails (e.g., invalid key/data)', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(
        'invalidIv:invalidEncryptedData',
      );
      (service as any).decryptData = jest.fn(() => {
        configService.get('ENCRYPTION_KEY');
        throw new Error('Invalid decryption data');
      });

      await expect(
        service.getAccessToken(mockTokenData.member_id),
      ).rejects.toThrow('Invalid decryption data');
      expect((service as any).decryptData).toHaveBeenCalledWith(
        'invalidIv:invalidEncryptedData',
      );
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });
  });

  describe('getTokenData', () => {
    it('should return all token data if found and decrypted', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(
        mockEncryptedDataString,
      );

      const result = await service.getTokenData(mockTokenData.member_id);

      expect(result).toEqual(mockTokenData);
      expect(redisService.get).toHaveBeenCalledWith(
        `token:${mockTokenData.member_id}`,
      );
      expect((service as any).decryptData).toHaveBeenCalledWith(
        mockEncryptedDataString,
      );
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('should return null if token data not found in Redis', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      const result = await service.getTokenData(mockTokenData.member_id);

      expect(result).toBeNull();
      expect(redisService.get).toHaveBeenCalledWith(
        `token:${mockTokenData.member_id}`,
      );
      expect((service as any).decryptData).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    const refreshToken = 'oldRefreshToken';
    const memberId = 'mockMemberId';
    const newAccessToken = 'newMockAccessToken';
    const newRefreshToken = 'newMockRefreshToken';
    const newExpiresIn = 3500;
    const refreshedTokenData = {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: newExpiresIn,
    };
    const expectedUrl = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=${mockClientId}&client_secret=${mockClientSecret}&refresh_token=${refreshToken}`;

    beforeEach(() => {
      (service as any).encryptData = jest.fn(() => {
        configService.get('ENCRYPTION_KEY');
        return mockEncryptedDataString;
      });
      (service as any).decryptData = jest.fn(() => {
        configService.get('ENCRYPTION_KEY');
        return refreshedTokenData;
      });
    });

    it('should refresh the access token, encrypt, and store it', async () => {
      (httpService.post as jest.Mock).mockReturnValue(
        of({ data: refreshedTokenData }),
      );
      const result = await service.refreshAccessToken(refreshToken, memberId);

      expect(httpService.post).toHaveBeenCalledWith(expectedUrl);
      expect((service as any).encryptData).toHaveBeenCalledWith(
        refreshedTokenData,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        `token:${memberId}`,
        mockEncryptedDataString,
        newExpiresIn,
      );
      expect(result).toBe(newAccessToken);
      expect(logger.info).toHaveBeenCalledWith(
        `Refreshing token for member_id: ${memberId}`,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Refreshed and stored new token for member_id: ${memberId}`,
      );
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_ID');
      expect(configService.get).toHaveBeenCalledWith('BITRIX24_CLIENT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('should throw UnauthorizedException on API error', async () => {
      const errorMessage = 'Refresh failed';
      (httpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error(errorMessage)),
      );

      await expect(
        service.refreshAccessToken(refreshToken, memberId),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshAccessToken(refreshToken, memberId),
      ).rejects.toThrow(`Failed to refresh token: ${errorMessage}`);
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to refresh token: ${errorMessage}`,
      );
      expect((service as any).encryptData).not.toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('getDomain', () => {
    it('should return the domain from decrypted token data', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(
        mockEncryptedDataString,
      );

      const result = await service.getDomain(mockTokenData.member_id);

      expect(result).toBe(mockTokenData.domain);
      expect(redisService.get).toHaveBeenCalledWith(
        `token:${mockTokenData.member_id}`,
      );
      expect((service as any).decryptData).toHaveBeenCalledWith(
        mockEncryptedDataString,
      );
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('should throw UnauthorizedException if no token data found', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);

      await expect(service.getDomain(mockTokenData.member_id)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getDomain(mockTokenData.member_id)).rejects.toThrow(
        'No token data in Redis',
      );
      expect(logger.error).toHaveBeenCalledWith(
        `No token data found for member_id: ${mockTokenData.member_id}`,
      );
      expect((service as any).decryptData).not.toHaveBeenCalled();
    });

    it('should throw error if decryption fails', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('invalid');
      (service as any).decryptData = jest.fn(() => {
        configService.get('ENCRYPTION_KEY');
        throw new Error('Malformed data');
      });

      await expect(service.getDomain(mockTokenData.member_id)).rejects.toThrow(
        'Malformed data',
      );
      expect((service as any).decryptData).toHaveBeenCalledWith('invalid');
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });
  });

  describe('Encryption/Decryption methods', () => {
    let originalEncryptData: Function;
    let originalDecryptData: Function;
    let originalGetEncryptionKey: Function;

    beforeEach(() => {
      jest.clearAllMocks();

      originalEncryptData = (service as any).encryptData;
      originalDecryptData = (service as any).decryptData;
      originalGetEncryptionKey = (service as any).getEncryptionKey;

      (crypto.randomBytes as jest.Mock).mockReturnValue(
        Buffer.from(mockIv, 'hex'),
      );
      (service as any).encryptData = (data: any) => {
        const key = (service as any).getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
      };
      (service as any).decryptData = (encrypted: string) => {
        const [ivHex, encryptedData] = encrypted.split(':');
        const key = (service as any).getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
      };

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ENCRYPTION_KEY') return mockEncryptionKey;
        return jest
          .requireActual('@nestjs/config')
          .ConfigService.prototype.get.call(configService, key);
      });
    });

    afterEach(() => {
      (service as any).encryptData = originalEncryptData;
      (service as any).decryptData = originalDecryptData;
      (service as any).getEncryptionKey = originalGetEncryptionKey;
    });

    it('should encrypt and decrypt data correctly', () => {
      const originalData = { key: 'value', number: 123, array: [1, 2, 3] };
      const serviceAny = service as any;
      const encrypted = serviceAny.encryptData(originalData);

      expect(encrypted).toMatch(/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/);
      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
      expect(encrypted.length).toBeGreaterThan(mockIv.length + 1);

      const decrypted = serviceAny.decryptData(encrypted);

      expect(decrypted).toEqual(originalData);
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('getEncryptionKey should throw error if ENCRYPTION_KEY is not defined', () => {
      const originalGetEncryptionKeyFunction = (service as any)
        .getEncryptionKey;
      (configService.get as jest.Mock).mockReturnValueOnce(undefined);
      const serviceAny = service as any;

      expect(() => originalGetEncryptionKeyFunction.call(serviceAny)).toThrow(
        'ENCRYPTION_KEY is not defined',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'ENCRYPTION_KEY is not defined in environment variables',
      );
    });

    it('getEncryptionKey should throw error if ENCRYPTION_KEY has invalid format', () => {
      const originalGetEncryptionKeyFunction = (service as any)
        .getEncryptionKey;
      (configService.get as jest.Mock).mockReturnValueOnce(
        'invalid-key-format',
      );
      const serviceAny = service as any;

      expect(() => originalGetEncryptionKeyFunction.call(serviceAny)).toThrow(
        'Invalid ENCRYPTION_KEY format',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'ENCRYPTION_KEY must be a 64-character hex string',
      );
    });

    it('getEncryptionKey should return Buffer from valid hex string', () => {
      const originalGetEncryptionKeyFunction = (service as any)
        .getEncryptionKey;
      const serviceAny = service as any;
      const keyBuffer = originalGetEncryptionKeyFunction.call(serviceAny);

      expect(keyBuffer).toBeInstanceOf(Buffer);
      expect(keyBuffer.toString('hex')).toBe(mockEncryptionKey);
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });
  });
});
