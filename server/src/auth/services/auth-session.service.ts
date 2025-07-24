import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async create(memberId: string, ttl = 600): Promise<string> {
    const sessionToken = uuidv4();
    try {
      // Lưu session vào Redis
      await this.redisService.set(
        RedisKeys.session(sessionToken),
        memberId,
        ttl,
      );

      // Thêm sessionToken vào Set của memberId
      const sessionSetKey = RedisKeys.sessionSet(memberId);
      await this.redisService.sadd(sessionSetKey, sessionToken);
      await this.redisService.expire(sessionSetKey, ttl);

      this.logger.info(
        `Session created successfully for memberId: ${memberId} with token: ${sessionToken}. TTL: ${ttl}s`,
      );

      return sessionToken;
    } catch (error) {
      this.logger.error(
        `Failed to create session for memberId: ${memberId}`,
        error,
      );
      throw error;
    }
  }

  async getMemberId(sessionToken: string): Promise<string> {
    let memberId: string | null = null;
    try {
      memberId = await this.redisService.get(RedisKeys.session(sessionToken));
    } catch (error) {
      this.logger.error(
        `Failed to get session from Redis for sessionToken: ${sessionToken}`,
        error,
      );
      throw new UnauthorizedException(
        'Session service unavailable or invalid session.',
      );
    }

    if (!memberId) {
      this.logger.warn(
        `Invalid or expired session token received: ${sessionToken}.`,
      );
      throw new UnauthorizedException('Invalid session token');
    }

    this.logger.debug(
      `Successfully retrieved memberId: ${memberId} for sessionToken: ${sessionToken}.`,
    );

    return memberId;
  }

  async delete(sessionToken: string): Promise<void> {
    try {
      const memberId = await this.redisService.get(
        RedisKeys.session(sessionToken),
      );

      if (memberId) {
        const sessionSetKey = RedisKeys.sessionSet(memberId);
        await Promise.all([
          this.redisService.del(RedisKeys.session(sessionToken)),
          this.redisService.srem(sessionSetKey, sessionToken),
        ]);
        this.logger.info(
          `Session successfully deleted for token: ${sessionToken}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete session for token: ${sessionToken}`,
        error,
      );
      throw error;
    }
  }

  async deleteAllSessions(memberId: string): Promise<void> {
    try {
      const sessionSetKey = RedisKeys.sessionSet(memberId);
      const sessionTokens = await this.redisService.smembers(sessionSetKey);
      if (sessionTokens.length > 0) {
        const sessionKeys = sessionTokens.map((token) =>
          RedisKeys.session(token),
        );
        await Promise.all([
          this.redisService.del(...sessionKeys),
          this.redisService.del(sessionSetKey),
        ]);
        this.logger.info(
          `Deleted ${sessionTokens.length} sessions for memberId: ${memberId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete sessions for memberId: ${memberId}`,
        error,
      );
      throw error;
    }
  }
}
