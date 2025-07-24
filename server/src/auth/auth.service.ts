import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
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
  private readonly limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 500,
    retryOptions: {
      maxRetries: 3,
      delay: (retryCount) => retryCount * 1000,
      retryOn: (error: AxiosError) => {
        const status = error?.response?.status;
        const shouldRetry = status === 429 || (status && status >= 500);
        if (shouldRetry) {
          this.logger.warn(
            `Retrying request due to status code: ${status}. Attempt: ${error.config?.url}`,
          );
        }

        return shouldRetry;
      },
    },
  });

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly tokenService: AuthTokenService,
    private readonly sessionService: AuthSessionService,
    private readonly stateService: AuthStateService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.limiter.on('failed', (error, info) => {
      this.logger.error(
        `Bottleneck request failed: ${error.message}. Retries left: ${info.retryCount}.`,
      );
    });
    this.limiter.on('error', (error) => {
      this.logger.error(
        `Bottleneck encountered an unhandled error: ${error.message}`,
      );
    });
    this.limiter.on('depleted', () => {
      this.logger.debug('Bottleneck queue is depleted.');
    });
    this.limiter.on('queued', () => {
      this.logger.debug('Request queued in Bottleneck.');
    });
  }

  // Tạo authorization URL cho quá trình OAuth
  async generateAuthUrl(
    domain: string,
  ): Promise<{ url: string; state: string }> {
    const clientId = this.config.get<string>('BITRIX24_CLIENT_ID');
    if (!clientId) {
      this.logger.error('Missing BITRIX24_CLIENT_ID in configuration.');
      throw new Error('Missing client ID');
    }

    const state = uuidv4();
    try {
      await this.stateService.save(domain, state);
      this.logger.info(
        `Generated auth URL for domain: ${domain}. State saved.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save state for domain: ${domain} during auth URL generation.`,
        error,
      );
      throw error;
    }

    const authUrl = `https://${domain}/oauth/authorize?client_id=${clientId}&state=${state}`;
    this.logger.debug(`Generated authorization URL: ${authUrl}`);

    return { url: authUrl, state };
  }

  // Trao đổi authorization code lấy access token và refresh token
  async exchangeCodeForToken(
    code: string,
    domain: string,
  ): Promise<{ memberId: string; sessionToken: string }> {
    const clientId = this.config.get<string>('BITRIX24_CLIENT_ID');
    const clientSecret = this.config.get<string>('BITRIX24_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      this.logger.error(
        'Missing BITRIX24_CLIENT_ID or BITRIX24_CLIENT_SECRET in configuration.',
      );
      throw new Error('Missing client credentials');
    }

    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}`;
    this.logger.debug(
      `Attempting to exchange code for token for domain: ${domain}`,
    );

    let data: any;
    try {
      const response = await this.limiter.schedule(() =>
        firstValueFrom(this.http.post(url)),
      );
      data = response.data;
      this.logger.info(
        `Successfully exchanged code for token for domain: ${domain}. Member ID: ${data.member_id}`,
      );
    } catch (error: any) {
      if (error.isAxiosError) {
        this.logger.error(
          `Failed to exchange code for token for domain: ${domain}. HTTP Status: ${error.response?.status}, Data: ${JSON.stringify(error.response?.data)}`,
          error,
        );
      } else {
        this.logger.error(
          `An unexpected error occurred during code exchange for domain: ${domain}`,
          error,
        );
      }
      throw new UnauthorizedException('Failed to exchange code for token.');
    }

    const { access_token, refresh_token, expires_in, member_id } = data;
    const tokenData = { access_token, refresh_token, expires_in, domain };

    try {
      await this.tokenService.saveToken(member_id, tokenData, expires_in);
      this.logger.debug(`Token data saved for member_id: ${member_id}`);
    } catch (error) {
      this.logger.error(
        `Failed to save token data for member_id: ${member_id} after code exchange.`,
        error,
      );
      throw error;
    }

    let sessionToken: string;
    try {
      sessionToken = await this.sessionService.create(member_id);
      this.logger.debug(
        `Session created for member_id: ${member_id}. Session token: ${sessionToken.substring(0, 8)}...`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create session for member_id: ${member_id} after token exchange.`,
        error,
      );
      throw error;
    }

    return { memberId: member_id, sessionToken };
  }

  // Làm mới access token bằng refresh token
  async refreshToken(memberId: string): Promise<string> {
    this.logger.info(`Attempting to refresh token for member_id: ${memberId}.`);
    const oldTokenData = await this.tokenService.getToken(memberId);
    if (!oldTokenData || !oldTokenData.refresh_token) {
      this.logger.warn(
        `No valid old token data or refresh token found for member_id: ${memberId}. Cannot refresh.`,
      );
      throw new UnauthorizedException('No valid refresh token to renew.');
    }

    const clientId = this.config.get('BITRIX24_CLIENT_ID');
    const clientSecret = this.config.get('BITRIX24_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      this.logger.error(
        'Missing BITRIX24_CLIENT_ID or BITRIX24_CLIENT_SECRET for refresh token request.',
      );
      throw new Error('Missing client credentials');
    }

    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${oldTokenData.refresh_token}`;

    let newData: any;
    try {
      const response = await this.limiter.schedule(() =>
        firstValueFrom(this.http.post(url)),
      );
      newData = response.data;
      this.logger.info(
        `Successfully refreshed token for member_id: ${memberId}.`,
      );
    } catch (error: any) {
      if (error.isAxiosError) {
        this.logger.error(
          `Failed to refresh token for member_id: ${memberId}. HTTP Status: ${error.response?.status}, Data: ${JSON.stringify(error.response?.data)}`,
          error,
        );
      } else {
        this.logger.error(
          `An unexpected error occurred during token refresh for member_id: ${memberId}`,
          error,
        );
      }
      throw new UnauthorizedException(
        'Failed to refresh token. Please re-authenticate.',
      );
    }

    const { access_token, refresh_token, expires_in } = newData;
    try {
      await this.tokenService.saveToken(
        memberId,
        { ...oldTokenData, access_token, refresh_token, expires_in },
        expires_in,
      );
      this.logger.debug(
        `New token data saved for member_id: ${memberId} after refresh.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save new token data after refresh for member_id: ${memberId}.`,
        error,
      );
      throw error;
    }

    return access_token;
  }

  // Lấy access token hiện tại của member
  async getAccessToken(memberId: string): Promise<string | null> {
    this.logger.debug(
      `Attempting to get access token for memberId: ${memberId}.`,
    );
    const accessToken = await this.tokenService.getAccessToken(memberId);
    if (accessToken) {
      this.logger.debug(`Access token found for memberId: ${memberId}.`);
    } else {
      this.logger.debug(`No access token found for memberId: ${memberId}.`);
    }

    return accessToken;
  }

  // Lấy domain liên quan đến token của member
  async getDomain(memberId: string): Promise<string> {
    this.logger.debug(`Attempting to get domain for memberId: ${memberId}.`);
    const domain = await this.tokenService.getDomain(memberId);
    this.logger.debug(`Domain retrieved for memberId: ${memberId}: ${domain}`);

    return domain;
  }

  // Lấy memberId từ một session token
  async getMemberIdFromSession(sessionToken: string): Promise<string> {
    this.logger.debug(
      `Attempting to get memberId from session for token: ${sessionToken.substring(0, 8)}...`,
    );
    const memberId = await this.sessionService.getMemberId(sessionToken);
    this.logger.debug(
      `MemberId: ${memberId} retrieved from session for token: ${sessionToken.substring(0, 8)}...`,
    );

    return memberId;
  }

  // Xác thực state nhận được
  async validateState(domain: string, state: string): Promise<boolean> {
    this.logger.debug(`Attempting to validate state for domain: ${domain}.`);
    const isValid = await this.stateService.validate(domain, state);
    if (isValid) {
      this.logger.info(`State successfully validated for domain: ${domain}.`);
    } else {
      this.logger.warn(`State validation failed for domain: ${domain}.`);
    }

    return isValid;
  }

  // Đảm bảo access token hiện tại của member còn hiệu lực
  async ensureValidAccessToken(memberId: string): Promise<string | null> {
    this.logger.debug(`Ensuring valid access token for memberId: ${memberId}.`);
    const token = await this.tokenService.getAccessToken(memberId);
    if (token) {
      this.logger.debug(
        `Existing access token is valid for memberId: ${memberId}.`,
      );
      return token;
    }

    const fullToken = await this.tokenService.getToken(memberId);
    if (!fullToken?.refresh_token) {
      this.logger.warn(
        `No refresh token available for member_id: ${memberId}. Requires re-authentication.`,
      );
      throw new UnauthorizedException(
        'No valid refresh token. Please re-authenticate.',
      );
    }

    try {
      const newAccessToken = await this.refreshToken(memberId);
      this.logger.info(
        `Access token successfully refreshed and returned for member_id: ${memberId}.`,
      );

      return newAccessToken;
    } catch (error) {
      this.logger.error(
        `Failed to refresh token for member_id: ${memberId}. Requires re-authentication.`,
        error,
      );
      throw new UnauthorizedException(
        'Failed to refresh token. Please re-authenticate.',
      );
    }
  }
}
