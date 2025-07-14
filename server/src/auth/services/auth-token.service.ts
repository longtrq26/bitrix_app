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

  async saveToken(
    memberId: string,
    tokenData: any,
    ttl: number,
  ): Promise<void> {
    const encrypted = this.cryptoService.encrypt(tokenData);

    await this.redisService.set(RedisKeys.token(memberId), encrypted, ttl);

    this.logger.info(`Token saved for member_id: ${memberId}`);
  }

  async getToken(memberId: string): Promise<any | null> {
    const encrypted = await this.redisService.get(RedisKeys.token(memberId));

    return encrypted ? this.cryptoService.decrypt(encrypted) : null;
  }

  async getAccessToken(memberId: string): Promise<string | null> {
    const token = await this.getToken(memberId);

    return token?.access_token ?? null;
  }

  async getDomain(memberId: string): Promise<string> {
    const token = await this.getToken(memberId);
    if (!token) throw new UnauthorizedException('No token data');

    return token.domain;
  }
}
