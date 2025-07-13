import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get('redirect')
  @ApiOperation({ summary: 'Redirect to Bitrix24 OAuth authorization' })
  @ApiQuery({ name: 'domain', type: String, description: 'Bitrix24 domain' })
  @ApiResponse({ status: 302, description: 'Redirects to Bitrix24 OAuth URL' })
  async redirectToBitrix(
    @Query('domain') domain: string,
    @Res() res: Response,
  ) {
    if (!domain || !domain.endsWith('.bitrix24.vn')) {
      throw new HttpException('Invalid domain', HttpStatus.BAD_REQUEST);
    }

    const { url, state } = await this.authService.generateAuthUrl(domain);

    await this.authService.storeState(domain, state);

    this.logger.info(`Redirecting to Bitrix24 OAuth for domain: ${domain}`);

    return res.redirect(url);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle OAuth callback from Bitrix24' })
  @ApiQuery({ name: 'code', type: String, description: 'Authorization code' })
  @ApiQuery({ name: 'domain', type: String, description: 'Bitrix24 domain' })
  @ApiQuery({
    name: 'state',
    type: String,
    description: 'State parameter for CSRF protection',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with member_id',
  })
  async handleCallback(
    @Query('code') code: string,
    @Query('domain') domain: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!domain || !domain.endsWith('.bitrix24.vn')) {
      throw new HttpException('Invalid domain', HttpStatus.BAD_REQUEST);
    }

    const storedState = await this.authService.getStoredState(domain);
    if (!storedState || storedState !== state) {
      this.logger.error(`Invalid state for domain: ${domain}`);
      throw new HttpException('Invalid state', HttpStatus.BAD_REQUEST);
    }

    try {
      const token = await this.authService.exchangeCodeForToken(code, domain);
      const memberId = token.member_id;
      const clientRedirect = this.configService.get('CLIENT_REDIRECT_URL');

      this.logger.info(
        `Redirecting to frontend: ${clientRedirect} for member_id: ${memberId}`,
      );

      return res.redirect(
        `${clientRedirect}/auth/callback?member_id=${memberId}`,
      );
    } catch (error) {
      this.logger.error(`OAuth callback failed for domain: ${domain}`, error);
      throw new HttpException(
        `OAuth callback failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('domain')
  @ApiOperation({ summary: 'Get domain for a member ID' })
  @ApiQuery({ name: 'memberId', type: String, description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'Returns the domain as plain text' })
  @ApiResponse({ status: 404, description: 'Domain not found' })
  async getDomain(@Query('memberId') memberId: string, @Res() res: Response) {
    try {
      const domain = await this.authService.getDomain(memberId);

      this.logger.info(`Retrieved domain for member_id: ${memberId}`);

      return res.status(200).send(domain);
    } catch (error) {
      this.logger.error(
        `Failed to get domain for member_id: ${memberId}`,
        error,
      );
      return res.status(404).send('Not Found');
    }
  }
}
