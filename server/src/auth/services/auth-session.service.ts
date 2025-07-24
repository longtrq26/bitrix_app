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

  // Tạo session mới
  async create(memberId: string, ttl = 600): Promise<string> {
    // Tạo session token bằng UUID v4
    const sessionToken = uuidv4();
    try {
      await this.redisService.set(
        RedisKeys.session(sessionToken),
        memberId,
        ttl,
      );

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

  // Lấy memberId từ session token
  async getMemberId(sessionToken: string): Promise<string> {
    let memberId: string | null = null;
    try {
      // Lấy memberId từ Redis sử dụng sessionToken làm key
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

    // Nếu session token không tồn tại hoặc đã hết hạn
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
      await this.redisService.del(RedisKeys.session(sessionToken));

      this.logger.info(
        `Session successfully deleted for token: ${sessionToken}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete session for token: ${sessionToken}`,
        error,
      );
      throw error;
    }
  }
}
