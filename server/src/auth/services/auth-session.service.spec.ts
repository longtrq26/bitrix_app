import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRedisService = {
      set: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthSessionService>(AuthSessionService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new session and return session token', async () => {
      const memberId = 'test-member-id';
      const ttl = 600;

      redisService.set.mockResolvedValue(undefined);

      const sessionToken = await service.create(memberId, ttl);

      expect(sessionToken).toBeDefined();
      expect(typeof sessionToken).toBe('string');
      expect(sessionToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        RedisKeys.session(sessionToken),
        memberId,
        ttl,
      );
    });

    it('should use default ttl of 600 when not provided', async () => {
      const memberId = 'test-member-id';

      redisService.set.mockResolvedValue(undefined);

      const sessionToken = await service.create(memberId);

      expect(redisService.set).toHaveBeenCalledWith(
        RedisKeys.session(sessionToken),
        memberId,
        600,
      );
    });
  });

  describe('getMemberId', () => {
    it('should return memberId when session token is valid', async () => {
      const sessionToken = 'valid-session-token';
      const memberId = 'test-member-id';

      redisService.get.mockResolvedValue(memberId);

      const result = await service.getMemberId(sessionToken);

      expect(result).toBe(memberId);
      expect(redisService.get).toHaveBeenCalledWith(
        RedisKeys.session(sessionToken),
      );
    });

    it('should throw UnauthorizedException when session token does not exist', async () => {
      const sessionToken = 'invalid-session-token';

      redisService.get.mockResolvedValue(null);

      await expect(service.getMemberId(sessionToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redisService.get).toHaveBeenCalledWith(
        RedisKeys.session(sessionToken),
      );
    });

    it('should throw UnauthorizedException when session token is expired', async () => {
      const sessionToken = 'expired-session-token';

      redisService.get.mockResolvedValue(null);

      await expect(service.getMemberId(sessionToken)).rejects.toThrow(
        new UnauthorizedException('Invalid session token'),
      );
    });
  });
});
