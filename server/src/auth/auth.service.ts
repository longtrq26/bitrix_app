import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';
import { TokenResponse } from './interface/token-response.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  generateAuthUrl(domain: string): string {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const state = Date.now().toString();
    return `https://${domain}/oauth/authorize?client_id=${clientId}&state=${state}`;
  }

  async exchangeCodeForToken(
    code: string,
    domain: string,
  ): Promise<TokenResponse> {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'BITRIX24_CLIENT_SECRET',
    );
    const url = `${this.configService.get<string>('BITRIX24_OAUTH_ENDPOINT')}/oauth/token/?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}`;
    this.logger.log(`Requesting token for domain: ${domain}`);

    const { data } = await firstValueFrom(this.httpService.post(url));
    const { access_token, refresh_token, expires_in, member_id } = data;

    await this.redisService.set(
      `token:${member_id}`,
      JSON.stringify({
        access_token,
        refresh_token,
        expires_in,
        domain,
      }),
      expires_in,
    );

    this.logger.log(`Stored token in Redis for member_id=${member_id}`);
    return data;
  }

  async getAccessToken(memberId: string): Promise<string | null> {
    const cached = await this.redisService.get(`token:${memberId}`);
    if (!cached) return null;
    const { access_token } = JSON.parse(cached);
    return access_token;
  }

  async refreshAccessToken(
    refreshToken: string,
    memberId: string,
  ): Promise<string> {
    const clientId = this.configService.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'BITRIX24_CLIENT_SECRET',
    );
    const url = `${this.configService.get<string>('BITRIX24_OAUTH_ENDPOINT')}/oauth/token/?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`;
    const { data } = await firstValueFrom(this.httpService.post(url));

    const { access_token, refresh_token, expires_in } = data;

    await this.redisService.set(
      `token:${memberId}`,
      JSON.stringify({ access_token, refresh_token, expires_in }),
      expires_in,
    );
    this.logger.log(`Refreshed and stored new token for member_id=${memberId}`);
    return access_token;
  }

  async getDomain(memberId: string): Promise<string> {
    const tokenData = await this.redisService.get(`token:${memberId}`);
    if (!tokenData) {
      throw new UnauthorizedException('No token data in Redis');
    }

    const parsed = JSON.parse(tokenData);
    return parsed.domain;
  }
}
