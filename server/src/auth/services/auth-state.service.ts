import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';
import { Logger } from 'winston';

@Injectable()
export class AuthStateService {
  constructor(
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Lưu state vào Redis cho một domain cụ thể (prevent CSRF)
  async save(domain: string, state: string): Promise<void> {
    try {
      // Lưu state vào Redis với key được tạo từ domain và thời gian sống 10 phút (600 giây)
      const ttl = 600;
      await this.redisService.set(RedisKeys.state(domain), state, ttl);

      this.logger.info(
        `State saved successfully for domain: ${domain}. State: ${state}, TTL: ${ttl}s`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save state for domain: ${domain}, state: ${state}`,
        error,
      );
      throw error;
    }
  }

  // Xác thực state đến với state đã lưu trong Redis cho domain đó
  async validate(domain: string, incomingState: string): Promise<boolean> {
    let stored: string | null = null;
    try {
      // Lấy state đã lưu từ Redis bằng domain
      stored = await this.redisService.get(RedisKeys.state(domain));
    } catch (error) {
      this.logger.error(
        `Failed to retrieve state from Redis for domain: ${domain}`,
        error,
      );
      return false;
    }

    if (!stored) {
      this.logger.warn(
        `No stored state found for domain: ${domain}. Incoming state: ${incomingState}. Validation failed.`,
      );
      return false;
    }

    // So sánh state đã lưu với state đến
    const isValid = stored === incomingState;

    if (isValid) {
      this.logger.info(`State validated successfully for domain: ${domain}.`);
      try {
        await this.redisService.del(RedisKeys.state(domain));

        this.logger.debug(`Deleted validated state for domain: ${domain}.`);
      } catch (deleteError) {
        this.logger.error(
          `Failed to delete state after successful validation for domain: ${domain}`,
          deleteError,
        );
      }
    } else {
      this.logger.warn(
        `State validation failed for domain: ${domain}. Stored: "${stored}", Incoming: "${incomingState}".`,
      );
    }

    return isValid;
  }
}
