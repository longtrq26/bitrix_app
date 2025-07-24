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
      const payload = {
        ...tokenData,
        created_at: Math.floor(Date.now() / 1000),
      };
      let encrypted: string | null = null;
      try {
        encrypted = this.cryptoService.encrypt(payload);
      } catch (encryptError) {
        this.logger.error(
          `Encryption threw an error for memberId=${memberId}`,
          encryptError,
        );
        return;
      }

      if (!encrypted) {
        this.logger.error(
          `Encryption failed for memberId=${memberId}. Encrypted result was null/undefined.`,
        );
        return;
      }

      await this.redisService.set(RedisKeys.token(memberId), encrypted, ttl);

      this.logger.info(`Token saved successfully for member_id: ${memberId}`);
    } catch (error) {
      this.logger.error(`Failed to save token for ${memberId}`, error);
    }
  }

  // Lấy token data từ Redis và decrypt
  async getToken(memberId: string): Promise<any | null> {
    // Lấy data đã encrypted từ Redis
    const encrypted = await this.redisService.get(RedisKeys.token(memberId));
    if (!encrypted) {
      this.logger.debug(
        `No encrypted token found in Redis for memberId: ${memberId}`,
      );
      return null;
    }

    let decryptedData: any | null = null;
    try {
      decryptedData = this.cryptoService.decrypt(encrypted);
    } catch (decryptError) {
      this.logger.error(
        `Decryption threw an error for memberId=${memberId} with encrypted data.`,
        decryptError,
      );
      return null;
    }

    if (!decryptedData) {
      this.logger.error(
        `Decryption failed for memberId=${memberId}. Decrypted result was null/undefined.`,
      );
    }

    return decryptedData;
  }

  // Lấy access token từ token data
  async getAccessToken(memberId: string): Promise<string | null> {
    // Lấy toàn bộ token data
    const token = await this.getToken(memberId);
    if (!token) {
      this.logger.debug(
        `No token data found for memberId: ${memberId} when trying to get access token.`,
      );
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpired = now > token.created_at + token.expires_in;
    if (isExpired) {
      this.logger.info(`Access token expired for memberId: ${memberId}.`);
      return null;
    }

    this.logger.debug(
      `Successfully retrieved access token for memberId: ${memberId}.`,
    );
    return token.access_token;
  }

  // Lấy domain từ token data
  async getDomain(memberId: string): Promise<string> {
    // Lấy toàn bộ token data
    const token = await this.getToken(memberId);
    if (!token) {
      this.logger.warn(
        `Attempted to retrieve domain for memberId: ${memberId} but no token data was found. Throwing UnauthorizedException.`,
      );
      throw new UnauthorizedException('No token data');
    }

    this.logger.debug(
      `Successfully retrieved domain for memberId: ${memberId}. Domain: ${token.domain}`,
    );
    return token.domain;
  }

  async delete(memberId: string): Promise<void> {
    try {
      await this.redisService.del(RedisKeys.token(memberId));

      this.logger.info(`Token successfully deleted for memberId: ${memberId}.`);
    } catch (error) {
      this.logger.error(
        `Failed to delete token for memberId: ${memberId}`,
        error,
      );
    }
  }
}
