import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(`Failed to get key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redisClient.set(key, value, 'EX', ttl);
    } catch (error) {
      this.logger.error(`Failed to set key ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}: ${error.message}`);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(`${prefix}:*`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(`Deleted ${keys.length} keys with prefix ${prefix}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete keys with prefix ${prefix}: ${error.message}`,
      );
    }
  }
}
