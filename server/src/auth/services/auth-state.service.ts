import { Injectable } from '@nestjs/common';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AuthStateService {
  constructor(private readonly redisService: RedisService) {}

  async save(domain: string, state: string): Promise<void> {
    await this.redisService.set(RedisKeys.state(domain), state, 600);
  }

  async validate(domain: string, incomingState: string): Promise<boolean> {
    const stored = await this.redisService.get(RedisKeys.state(domain));

    return stored === incomingState;
  }
}
