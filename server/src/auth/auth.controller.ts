import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuthService } from './auth.service';
import { AuthRedirectDto } from './dto/auth-redirect.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get('redirect')
  @ApiOperation({ summary: 'Redirect to Bitrix24 OAuth authorization' })
  @ApiQuery({ name: 'domain', type: String })
  @UsePipes(new ValidationPipe({ transform: true }))
  async redirectToBitrix(
    @Query() query: AuthRedirectDto,
    @Res() res: Response,
  ) {
    try {
      const { url } = await this.authService.generateAuthUrl(query.domain);

      return res.redirect(url);
    } catch (error) {
      this.logger.error('Redirect failed', error);
      throw new HttpException(
        'Failed to generate redirect URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle Bitrix24 OAuth callback' })
  @ApiQuery({ name: 'code' })
  @ApiQuery({ name: 'domain' })
  @ApiQuery({ name: 'state' })
  async handleCallback(
    @Query('code') code: string,
    @Query('domain') domain: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!domain.endsWith('.bitrix24.vn')) {
      throw new BadRequestException('Invalid domain');
    }

    const isValid = await this.authService.validateState(domain, state);
    if (!isValid) {
      throw new BadRequestException('Invalid state token');
    }

    const { sessionToken } = await this.authService.exchangeCodeForToken(
      code,
      domain,
    );

    return res.redirect(
      `${this.config.get('CLIENT_REDIRECT_URL')}/auth/callback?session=${sessionToken}`,
    );
  }

  @Get('domain')
  @ApiOperation({ summary: 'Get Bitrix24 domain from member ID' })
  @ApiQuery({ name: 'memberId' })
  async getDomain(@Query('memberId') memberId: string, @Res() res: Response) {
    try {
      const domain = await this.authService.getDomain(memberId);

      return res.status(200).send(domain);
    } catch (err) {
      return res.status(404).send('Domain not found');
    }
  }

  @Get('member')
  @ApiOperation({ summary: 'Get memberId from session token' })
  @ApiQuery({ name: 'session' })
  async getMemberId(
    @Query('session') sessionToken: string,
    @Res() res: Response,
  ) {
    try {
      const memberId =
        await this.authService.getMemberIdFromSession(sessionToken);

      return res.status(200).json({ memberId });
    } catch (err) {
      return res.status(401).send('Invalid session');
    }
  }
}
