import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { Logger } from 'winston';
import { AuthService } from './auth.service';
import { AuthDomainDto } from './dto/auth-domain.dto';
import { AuthSessionService } from './services/auth-session.service';
import { AuthTokenService } from './services/auth-token.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly sessionService: AuthSessionService,
    private readonly tokenService: AuthTokenService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get('redirect')
  async redirectToBitrix(@Query() query: AuthDomainDto, @Res() res: Response) {
    this.logger.debug(
      `Received request to redirect to Bitrix for domain: ${query.domain}`,
    );
    try {
      const { url } = await this.authService.generateAuthUrl(query.domain);
      this.logger.info(
        `Redirecting user to Bitrix24 authorization URL for domain: ${query.domain}`,
      );

      return res.redirect(url);
    } catch (error) {
      this.logger.error(
        `Failed to generate redirect URL for domain: ${query.domain}`,
        error,
      );
      throw new HttpException(
        'Failed to generate redirect URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query() query: AuthDomainDto,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    this.logger.debug(
      `Received callback from Bitrix24. Domain: ${query.domain}, State: ${state}, Code present: ${!!code}`,
    );

    if (!query.domain || !query.domain.endsWith('.bitrix24.vn')) {
      this.logger.warn(
        `Callback received with invalid domain: ${query.domain}`,
      );
      throw new BadRequestException('Invalid domain');
    }

    // Xác thực state
    try {
      const isValidState = await this.authService.validateState(
        query.domain,
        state,
      );
      if (!isValidState) {
        this.logger.warn(
          `Invalid state token detected for domain: ${query.domain}. State: ${state}`,
        );
        throw new BadRequestException('Invalid state token');
      }
      this.logger.debug(
        `State token validated successfully for domain: ${query.domain}.`,
      );
    } catch (error) {
      this.logger.error(
        `Error during state validation for domain: ${query.domain}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to validate state',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Gọi authService để đổi authorization code lấy token và tạo session token
    let sessionToken: string;
    try {
      const result = await this.authService.exchangeCodeForToken(
        code,
        query.domain,
      );
      sessionToken = result.sessionToken;
      this.logger.info(
        `Successfully exchanged code for token and created session for domain: ${query.domain}, Member ID: ${result.memberId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to exchange code for token or create session for domain: ${query.domain}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to process authentication callback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000,
    });
    this.logger.debug(`Session token cookie set for domain: ${query.domain}.`); // Thêm dòng này

    const clientRedirectUrl = this.config.get('CLIENT_REDIRECT_URL');
    if (!clientRedirectUrl) {
      this.logger.error(
        'CLIENT_REDIRECT_URL is not configured in environment variables.',
      );
      throw new HttpException(
        'Server configuration error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.debug(
      `Redirecting to client with session token for domain: ${query.domain}.`,
    );
    return res.redirect(
      `${clientRedirectUrl}/auth/callback?session=${sessionToken}`,
    );
  }

  @Get('domain')
  async getDomain(@Query('memberId') memberId: string, @Res() res: Response) {
    this.logger.debug(
      `Received request to get domain for memberId: ${memberId}`,
    );
    try {
      const domain = await this.authService.getDomain(memberId);
      this.logger.info(
        `Successfully retrieved domain for memberId: ${memberId}. Domain: ${domain}`,
      );
      return res.status(HttpStatus.OK).send(domain);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(
          `Unauthorized attempt to get domain for memberId: ${memberId}. ${error.message}`,
        );
        throw new UnauthorizedException(
          'Domain not found or unauthorized access.',
        );
      }
      this.logger.error(
        `Failed to get domain for memberId: ${memberId}`,
        error,
      );
      throw new HttpException(
        'Failed to retrieve domain',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('member')
  async getMemberId(
    @Query('session') sessionToken: string,
    @Res() res: Response,
  ) {
    this.logger.debug(
      `Received request to get memberId for session token: ${sessionToken.substring(0, 8)}...`,
    );
    try {
      const memberId =
        await this.authService.getMemberIdFromSession(sessionToken);
      this.logger.info(
        `Successfully retrieved memberId: ${memberId} from session token: ${sessionToken.substring(0, 8)}...`,
      );
      return res.status(HttpStatus.OK).json({ memberId });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(
          `Invalid session token: ${sessionToken.substring(0, 8)}... Unauthorized access.`,
        );
        throw new UnauthorizedException('Invalid session');
      }
      this.logger.error(
        `Failed to get memberId from session token: ${sessionToken.substring(0, 8)}...`,
        error,
      );
      throw new HttpException(
        'Failed to retrieve member ID',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('token')
  async getAccessToken(@MemberId() memberId: string, @Res() res: Response) {
    this.logger.debug(
      `Received request to get access token for memberId: ${memberId}`,
    );
    if (!memberId) {
      this.logger.warn(
        'Access token request received without a valid memberId from decorator.',
      );
      throw new UnauthorizedException('Member ID is required.');
    }

    try {
      // Dùng ensureValidAccessToken để tự động refresh nếu cần
      const accessToken =
        await this.authService.ensureValidAccessToken(memberId);

      if (!accessToken) {
        this.logger.warn(
          `No valid access token found or could be refreshed for memberId: ${memberId}.`,
        );
        throw new UnauthorizedException(
          'Token not found or expired. Please re-authenticate.',
        );
      }

      this.logger.info(
        `Successfully retrieved valid access token for memberId: ${memberId}.`,
      );
      return res.status(HttpStatus.OK).json({ access_token: accessToken });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(
          `Unauthorized access token request for memberId: ${memberId}. ${error.message}`,
        );
        throw error;
      }
      this.logger.error(
        `Failed to get or refresh access token for memberId: ${memberId}`,
        error,
      );
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('logout')
  async logout(
    @MemberId() memberId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Received logout request for memberId: ${memberId}`);
    if (!memberId) {
      this.logger.warn('Logout request received without a valid memberId.');
      throw new BadRequestException('Member ID is required for logout.');
    }

    const sessionToken = req.cookies['session_token'];

    if (sessionToken) {
      this.logger.debug(
        `Attempting to delete session for token: ${sessionToken.substring(0, 8)}...`,
      );
    } else {
      this.logger.debug('No session token found in cookies during logout.');
    }

    try {
      if (sessionToken) {
        await this.sessionService.delete(sessionToken);
      }
      await this.tokenService.delete(memberId);
      this.logger.info(
        `Successfully deleted session and token for memberId: ${memberId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete session or token during logout for memberId: ${memberId}. Session token: ${sessionToken?.substring(0, 8)}...`,
        error,
      );
    }

    res.clearCookie('session_token');
    this.logger.info(
      `Cleared session_token cookie for memberId: ${memberId}. Logout complete.`,
    );
    return { message: 'Logged out successfully' };
  }
}
