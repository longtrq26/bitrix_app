import { Test, TestingModule } from '@nestjs/testing';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  let service: AuthStateService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRedisService = {
      set: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthStateService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthStateService>(AuthStateService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('save', () => {
    it('should save state to Redis with correct key and TTL', async () => {
      const domain = 'test.bitrix24.vn';
      const state = 'test-state-value';

      redisService.set.mockResolvedValue(undefined);

      await service.save(domain, state);

      expect(redisService.set).toHaveBeenCalledWith(
        RedisKeys.state(domain),
        state,
        600,
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const domain = 'test.bitrix24.vn';
      const state = 'test-state-value';

      redisService.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.save(domain, state)).rejects.toThrow('Redis error');
    });
  });

  describe('validate', () => {
    it('should return true when incoming state matches stored state', async () => {
      const domain = 'test.bitrix24.vn';
      const state = 'test-state-value';

      redisService.get.mockResolvedValue(state);

      const result = await service.validate(domain, state);

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(RedisKeys.state(domain));
    });

    it('should return false when incoming state does not match stored state', async () => {
      const domain = 'test.bitrix24.vn';
      const storedState = 'stored-state';
      const incomingState = 'different-state';

      redisService.get.mockResolvedValue(storedState);

      const result = await service.validate(domain, incomingState);

      expect(result).toBe(false);
      expect(redisService.get).toHaveBeenCalledWith(RedisKeys.state(domain));
    });

    it('should return false when no state is stored', async () => {
      const domain = 'test.bitrix24.vn';
      const incomingState = 'some-state';

      redisService.get.mockResolvedValue(null);

      const result = await service.validate(domain, incomingState);

      expect(result).toBe(false);
      expect(redisService.get).toHaveBeenCalledWith(RedisKeys.state(domain));
    });

    it('should return false when stored state is null', async () => {
      const domain = 'test.bitrix24.vn';
      const incomingState = 'some-state';

      redisService.get.mockResolvedValue(null);

      const result = await service.validate(domain, incomingState);

      expect(result).toBe(false);
    });
  });
});
