import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthSessionService {
  constructor(private readonly redisService: RedisService) {}

  async create(memberId: string, ttl = 600): Promise<string> {
    const sessionToken = uuidv4();

    await this.redisService.set(RedisKeys.session(sessionToken), memberId, ttl);

    return sessionToken;
  }

  async getMemberId(sessionToken: string): Promise<string> {
    const memberId = await this.redisService.get(
      RedisKeys.session(sessionToken),
    );
    if (!memberId) throw new UnauthorizedException('Invalid session token');

    return memberId;
  }
}
