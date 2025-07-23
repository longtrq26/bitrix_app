import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { RedisService } from 'src/redis/redis.service';
import { Logger } from 'winston';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly redisService: RedisService,
    private readonly cryptoService: CryptoService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Lưu token data vào Redis sau khi đã encrypted
  async saveToken(
    memberId: string,
    tokenData: any,
    ttl: number,
  ): Promise<void> {
    try {
      const encrypted = this.cryptoService.encrypt(tokenData);
      if (!encrypted) {
        this.logger.error(`Encryption failed for memberId=${memberId}`);
        return;
      }

      await this.redisService.set(RedisKeys.token(memberId), encrypted, ttl);
      this.logger.info(`Token saved for member_id: ${memberId}`);
    } catch (error) {
      this.logger.error(`Failed to save token for ${memberId}`, error);
    }
  }

  // Lấy token data từ Redis và decrypt
  async getToken(memberId: string): Promise<any | null> {
    // Lấy data đã encrypted từ Redis
    const encrypted = await this.redisService.get(RedisKeys.token(memberId));

    // Decrypt và return hoặc return null
    return encrypted ? this.cryptoService.decrypt(encrypted) : null;
  }

  // Lấy access token từ token data
  async getAccessToken(memberId: string): Promise<string | null> {
    // Lấy toàn bộ token data
    const token = await this.getToken(memberId);

    // Return access_token từ token data hoặc return null
    return token?.access_token ?? null;
  }

  // Lấy domain từ token data
  async getDomain(memberId: string): Promise<string> {
    // Lấy toàn bộ token data
    const token = await this.getToken(memberId);
    if (!token) {
      throw new UnauthorizedException('No token data');
    }

    // Return domain từ token data
    return token.domain;
  }
}
