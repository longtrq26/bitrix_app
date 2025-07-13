import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bottleneck from 'bottleneck';
import * as crypto from 'crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { TokenResponse } from './interface/token-response.interface';

@Injectable()
export class AuthService {
  private readonly limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 500,
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async generateAuthUrl(
    domain: string,
  ): Promise<{ url: string; state: string }> {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const state = uuidv4();
    const url = `https://${domain}/oauth/authorize?client_id=${clientId}&state=${state}`;

    this.logger.info(`Generated OAuth URL for domain: ${domain}`);

    return { url, state };
  }

  async storeState(domain: string, state: string): Promise<void> {
    await this.redisService.set(`state:${domain}`, state, 600);

    this.logger.debug(`Stored state for domain: ${domain}`);
  }

  async getStoredState(domain: string): Promise<string | null> {
    return this.redisService.get(`state:${domain}`);
  }

  async exchangeCodeForToken(
    code: string,
    domain: string,
  ): Promise<TokenResponse> {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'BITRIX24_CLIENT_SECRET',
    );
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}`;

    this.logger.info(`Requesting token for domain: ${domain}`);

    try {
      const { data } = await this.limiter.schedule(() =>
        firstValueFrom(this.httpService.post(url)),
      );
      const { access_token, refresh_token, expires_in, member_id } = data;
      const tokenData = { access_token, refresh_token, expires_in, domain };
      const encryptedData = this.encryptData(tokenData);

      await this.redisService.set(
        `token:${member_id}`,
        encryptedData,
        expires_in,
      );

      this.logger.info(`Stored token in Redis for member_id: ${member_id}`);

      return data;
    } catch (error) {
      this.logger.error(`Failed to exchange code for token: ${error.message}`);
      throw new UnauthorizedException(
        `Failed to exchange code: ${error.message}`,
      );
    }
  }

  async getAccessToken(memberId: string): Promise<string | null> {
    const encrypted = await this.redisService.get(`token:${memberId}`);
    if (!encrypted) {
      return null;
    }
    const tokenData = this.decryptData(encrypted);

    return tokenData.access_token;
  }

  async getTokenData(memberId: string): Promise<any | null> {
    const encrypted = await this.redisService.get(`token:${memberId}`);
    if (!encrypted) {
      return null;
    }

    return this.decryptData(encrypted);
  }

  async refreshAccessToken(
    refreshToken: string,
    memberId: string,
  ): Promise<string> {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'BITRIX24_CLIENT_SECRET',
    );
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`;

    this.logger.info(`Refreshing token for member_id: ${memberId}`);

    try {
      const { data } = await this.limiter.schedule(() =>
        firstValueFrom(this.httpService.post(url)),
      );
      const { access_token, refresh_token, expires_in } = data;
      const tokenData = { access_token, refresh_token, expires_in };
      const encryptedData = this.encryptData(tokenData);

      await this.redisService.set(
        `token:${memberId}`,
        encryptedData,
        expires_in,
      );

      this.logger.info(
        `Refreshed and stored new token for member_id: ${memberId}`,
      );

      return access_token;
    } catch (error) {
      this.logger.error(`Failed to refresh token: ${error.message}`);
      throw new UnauthorizedException(
        `Failed to refresh token: ${error.message}`,
      );
    }
  }

  async getDomain(memberId: string): Promise<string> {
    const encrypted = await this.redisService.get(`token:${memberId}`);
    if (!encrypted) {
      this.logger.error(`No token data found for member_id: ${memberId}`);

      throw new UnauthorizedException('No token data in Redis');
    }
    const parsed = this.decryptData(encrypted);

    return parsed.domain;
  }

  private encryptData(data: any): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptData(encrypted: string): any {
    const [ivHex, encryptedData] = encrypted.split(':');
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      this.logger.error(
        'ENCRYPTION_KEY is not defined in environment variables',
      );
      throw new Error('ENCRYPTION_KEY is not defined');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      this.logger.error('ENCRYPTION_KEY must be a 64-character hex string');
      throw new Error('Invalid ENCRYPTION_KEY format');
    }

    return Buffer.from(key, 'hex');
  }
}
