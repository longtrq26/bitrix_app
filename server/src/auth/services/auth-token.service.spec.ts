import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { RedisService } from 'src/redis/redis.service';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  let service: AuthTokenService;
  let redisService: jest.Mocked<RedisService>;
  let cryptoService: jest.Mocked<CryptoService>;
  let logger: jest.Mocked<any>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRedisService = {
      set: jest.fn(),
      get: jest.fn(),
    };

    const mockCryptoService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTokenService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuthTokenService>(AuthTokenService);
    redisService = module.get(RedisService);
    cryptoService = module.get(CryptoService);
    logger = module.get(WINSTON_MODULE_PROVIDER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveToken', () => {
    it('should encrypt and save token data to Redis', async () => {
      const memberId = 'test-member-id';
      const tokenData = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
      };
      const ttl = 3600;
      const encryptedData = 'encrypted-token-data';

      cryptoService.encrypt.mockReturnValue(encryptedData);
      redisService.set.mockResolvedValue(undefined);

      await service.saveToken(memberId, tokenData, ttl);

      expect(cryptoService.encrypt).toHaveBeenCalledWith(tokenData);
      expect(redisService.set).toHaveBeenCalledWith(
        RedisKeys.token(memberId),
        encryptedData,
        ttl,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Token saved for member_id: ${memberId}`,
      );
    });
  });

  describe('getToken', () => {
    it('should decrypt and return token data when exists', async () => {
      const memberId = 'test-member-id';
      const encryptedData = 'encrypted-token-data';
      const tokenData = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
      };

      redisService.get.mockResolvedValue(encryptedData);
      cryptoService.decrypt.mockReturnValue(tokenData);

      const result = await service.getToken(memberId);

      expect(redisService.get).toHaveBeenCalledWith(RedisKeys.token(memberId));
      expect(cryptoService.decrypt).toHaveBeenCalledWith(encryptedData);
      expect(result).toEqual(tokenData);
    });

    it('should return null when no token data exists', async () => {
      const memberId = 'test-member-id';

      redisService.get.mockResolvedValue(null);

      const result = await service.getToken(memberId);

      expect(redisService.get).toHaveBeenCalledWith(RedisKeys.token(memberId));
      expect(cryptoService.decrypt).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when encrypted data is null', async () => {
      const memberId = 'test-member-id';

      redisService.get.mockResolvedValue(null);

      const result = await service.getToken(memberId);

      expect(result).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from token data', async () => {
      const memberId = 'test-member-id';
      const tokenData = {
        access_token: 'test-access-token',
        refresh_token: 'refresh-token',
      };

      jest.spyOn(service, 'getToken').mockResolvedValue(tokenData);

      const result = await service.getAccessToken(memberId);

      expect(result).toBe('test-access-token');
    });

    it('should return null when no token data exists', async () => {
      const memberId = 'test-member-id';

      jest.spyOn(service, 'getToken').mockResolvedValue(null);

      const result = await service.getAccessToken(memberId);

      expect(result).toBeNull();
    });

    it('should return null when access_token is undefined', async () => {
      const memberId = 'test-member-id';
      const tokenData = { refresh_token: 'refresh-token' };

      jest.spyOn(service, 'getToken').mockResolvedValue(tokenData);

      const result = await service.getAccessToken(memberId);

      expect(result).toBeNull();
    });
  });

  describe('getDomain', () => {
    it('should return domain from token data', async () => {
      const memberId = 'test-member-id';
      const tokenData = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        domain: 'test.bitrix24.vn',
      };

      jest.spyOn(service, 'getToken').mockResolvedValue(tokenData);

      const result = await service.getDomain(memberId);

      expect(result).toBe('test.bitrix24.vn');
    });

    it('should throw UnauthorizedException when no token data exists', async () => {
      const memberId = 'test-member-id';

      jest.spyOn(service, 'getToken').mockResolvedValue(null);

      await expect(service.getDomain(memberId)).rejects.toThrow(
        new UnauthorizedException('No token data'),
      );
    });

    it('should throw UnauthorizedException when token data is undefined', async () => {
      const memberId = 'test-member-id';

      jest.spyOn(service, 'getToken').mockResolvedValue(undefined);

      await expect(service.getDomain(memberId)).rejects.toThrow(
        new UnauthorizedException('No token data'),
      );
    });
  });
});
