import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

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

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete keys ${keys.join(', ')}: ${error.message}`,
      );
    }
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redisClient.sadd(key, ...members);
    } catch (error) {
      this.logger.error(
        `Failed to add members to set ${key}: ${error.message}`,
      );
    }
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redisClient.srem(key, ...members);
    } catch (error) {
      this.logger.error(
        `Failed to remove members from set ${key}: ${error.message}`,
      );
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redisClient.smembers(key);
    } catch (error) {
      this.logger.error(
        `Failed to get members of set ${key}: ${error.message}`,
      );
      return [];
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redisClient.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Failed to set TTL for key ${key}: ${error.message}`);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(`${prefix}:*`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.info(`Deleted ${keys.length} keys with prefix ${prefix}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete keys with prefix ${prefix}: ${error.message}`,
      );
    }
  }
}
