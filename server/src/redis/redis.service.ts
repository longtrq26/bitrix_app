import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<string>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');

    if (!host) {
      throw new Error(
        'REDIS_HOST environment variable is not set. Please check your .env file and ConfigModule setup.',
      );
    }
    if (!port) {
      throw new Error(
        'REDIS_PORT environment variable is not set. Please check your .env file and ConfigModule setup.',
      );
    }

    const parsedPort = parseInt(port, 10);

    if (isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
      throw new Error(
        `Invalid REDIS_PORT value: "${port}". Port must be a number between 0 and 65535. Check your .env file.`,
      );
    }

    this.client = new Redis({
      host: host,
      port: parsedPort,
      password: password,
    });
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttl);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
