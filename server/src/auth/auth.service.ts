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
  private readonly limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 500,
    retryOptions: {
      maxRetries: 3,
      delay: (retryCount) => retryCount * 1000,
    },
  });

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly tokenService: AuthTokenService,
    private readonly sessionService: AuthSessionService,
    private readonly stateService: AuthStateService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Tạo authorization URL cho quá trình OAuth
  async generateAuthUrl(
    domain: string,
  ): Promise<{ url: string; state: string }> {
    // Lấy clientId từ .env
    const clientId = this.config.get<string>('BITRIX24_CLIENT_ID');
    if (!clientId) {
      throw new Error('Missing client ID');
    }
    // Tạo state để chống CSRF
    const state = uuidv4();

    // Lưu state liên kết với domain vào Redis
    await this.stateService.save(domain, state);

    return {
      // authorization URL với domain, client_id và state
      url: `https://${domain}/oauth/authorize?client_id=${clientId}&state=${state}`,
      // Return state để client có thể giữ và xác thực sau này
      state,
    };
  }

  // Trao đổi authorization code lấy access token và refresh token
  async exchangeCodeForToken(
    code: string,
    domain: string,
  ): Promise<{ memberId: string; sessionToken: string }> {
    // Lấy clientId từ .env
    const clientId = this.config.get<string>('BITRIX24_CLIENT_ID');
    // Lấy clientSecret từ .env
    const clientSecret = this.config.get<string>('BITRIX24_CLIENT_SECRET');
    // URL để yêu cầu token từ Bitrix24 OAuth server
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}`;

    // Yêu cầu POST đến URL lấy token
    const { data } = await this.limiter.schedule(() =>
      // Đổi Observable sang Promise và thực hiện request
      firstValueFrom(this.http.post(url)),
    );
    // Trích xuất các thông tin cần thiết từ response
    const { access_token, refresh_token, expires_in, member_id } = data;

    // Tạo đối tượng chứa token data
    const tokenData = { access_token, refresh_token, expires_in, domain };
    // Lưu token data vào AuthTokenService
    await this.tokenService.saveToken(member_id, tokenData, expires_in);

    // Tạo session token mới cho memberId này
    const sessionToken = await this.sessionService.create(member_id);

    // Return memberId và session token mới tạo
    return { memberId: member_id, sessionToken };
  }

  // Làm mới access token bằng refresh token
  async refreshToken(memberId: string): Promise<string> {
    // Lấy toàn bộ token data cũ từ tokenService
    const old = await this.tokenService.getToken(memberId);
    // URL để yêu cầu refresh token từ Bitrix24 OAuth server
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=${this.config.get('BITRIX24_CLIENT_ID')}&client_secret=${this.config.get('BITRIX24_CLIENT_SECRET')}&refresh_token=${old.refresh_token}`;
    // Yêu cầu POST đến URL refresh token
    const { data } = await this.limiter.schedule(() =>
      // Đổi Observable sang Promise và thực hiện request
      firstValueFrom(this.http.post(url)),
    );

    // Trích xuất access_token, refresh_token mới và thời gian hết hạn mới
    const { access_token, refresh_token, expires_in } = data;
    // Lưu token mới vào AuthTokenService, cập nhật các fields cần thiết và duy trì các fields khác từ token cũ
    await this.tokenService.saveToken(
      memberId,
      { ...old, access_token, refresh_token, expires_in },
      expires_in,
    );

    // Trả về access token mới
    return access_token;
  }

  // Lấy access token hiện tại của member
  async getAccessToken(memberId: string): Promise<string | null> {
    // Gọi tokenService để lấy access token
    return this.tokenService.getAccessToken(memberId);
  }

  // Lấy domain liên quan đến token của member
  async getDomain(memberId: string): Promise<string> {
    // Gọi tokenService để lấy domain
    return this.tokenService.getDomain(memberId);
  }

  // Lấy memberId từ một session token
  async getMemberIdFromSession(sessionToken: string): Promise<string> {
    // Gọi sessionService để lấy memberId từ session token
    return this.sessionService.getMemberId(sessionToken);
  }

  // Xác thực state nhận được
  async validateState(domain: string, state: string): Promise<boolean> {
    // Gọi stateService để xác thực state
    return this.stateService.validate(domain, state);
  }

  // Đảm bảo access token hiện tại của member còn hiệu lực
  async ensureValidAccessToken(memberId: string): Promise<string | null> {
    // Lấy access token hiện có
    const token = await this.tokenService.getAccessToken(memberId);
    // Nếu token còn hiệu lực return ngay
    if (token) {
      return token;
    }

    // Lấy toàn bộ token data để kiểm tra refresh_token
    const fullToken = await this.tokenService.getToken(memberId);
    // Nếu không có refresh token không thể refresh
    if (!fullToken?.refresh_token) {
      return null;
    }

    try {
      // Refresh token
      return await this.refreshToken(memberId);
    } catch (error) {
      this.logger.warn(
        `Failed to refresh token for member_id ${memberId}: ${error.message}`,
      );
      return null;
    }
  }
}
