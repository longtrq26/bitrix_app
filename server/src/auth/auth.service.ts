import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Bottleneck from 'bottleneck';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { AuthSessionService } from './services/auth-session.service';
import { AuthStateService } from './services/auth-state.service';
import { AuthTokenService } from './services/auth-token.service';

@Injectable()
export class AuthService {
  private readonly limiter = new Bottleneck({ maxConcurrent: 1, minTime: 500 });

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly tokenService: AuthTokenService,
    private readonly sessionService: AuthSessionService,
    private readonly stateService: AuthStateService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async generateAuthUrl(
    domain: string,
  ): Promise<{ url: string; state: string }> {
    const clientId = this.config.get<string>('BITRIX24_CLIENT_ID');
    if (!clientId) throw new Error('Missing client ID');
    const state = uuidv4();

    await this.stateService.save(domain, state);

    return {
      url: `https://${domain}/oauth/authorize?client_id=${clientId}&state=${state}`,
      state,
    };
  }

  async exchangeCodeForToken(
    code: string,
    domain: string,
  ): Promise<{ memberId: string; sessionToken: string }> {
    const clientId = this.config.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.config.get<string>('BITRIX24_CLIENT_SECRET');
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}`;

    const { data } = await this.limiter.schedule(() =>
      firstValueFrom(this.http.post(url)),
    );
    const { access_token, refresh_token, expires_in, member_id } = data;

    const tokenData = { access_token, refresh_token, expires_in, domain };
    await this.tokenService.saveToken(member_id, tokenData, expires_in);
    const sessionToken = await this.sessionService.create(member_id);

    return { memberId: member_id, sessionToken };
  }

  async refreshToken(memberId: string): Promise<string> {
    const old = await this.tokenService.getToken(memberId);
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=${this.config.get('BITRIX24_CLIENT_ID')}&client_secret=${this.config.get('BITRIX24_CLIENT_SECRET')}&refresh_token=${old.refresh_token}`;
    const { data } = await this.limiter.schedule(() =>
      firstValueFrom(this.http.post(url)),
    );

    const { access_token, refresh_token, expires_in } = data;
    await this.tokenService.saveToken(
      memberId,
      { ...old, access_token, refresh_token, expires_in },
      expires_in,
    );
    return access_token;
  }

  async getAccessToken(memberId: string): Promise<string | null> {
    return this.tokenService.getAccessToken(memberId);
  }

  async getDomain(memberId: string): Promise<string> {
    return this.tokenService.getDomain(memberId);
  }

  async getMemberIdFromSession(sessionToken: string): Promise<string> {
    return this.sessionService.getMemberId(sessionToken);
  }

  async validateState(domain: string, state: string): Promise<boolean> {
    return this.stateService.validate(domain, state);
  }

  async ensureValidAccessToken(memberId: string): Promise<string | null> {
    const token = await this.tokenService.getAccessToken(memberId);
    if (token) return token;

    const fullToken = await this.tokenService.getToken(memberId);
    if (!fullToken?.refresh_token) return null;

    try {
      return await this.refreshToken(memberId);
    } catch (error) {
      this.logger.warn(
        `Failed to refresh token for member_id ${memberId}: ${error.message}`,
      );
      return null;
    }
  }
}
