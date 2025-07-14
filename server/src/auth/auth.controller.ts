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
import { AuthDomainDto } from './dto/auth-domain.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Endpoint redirect user đến trang OAuth của Bitrix24
  @Get('redirect')
  @ApiOperation({ summary: 'Redirect to Bitrix24 OAuth authorization' })
  @ApiQuery({ name: 'domain', type: String })
  @UsePipes(new ValidationPipe({ transform: true }))
  async redirectToBitrix(@Query() query: AuthDomainDto, @Res() res: Response) {
    try {
      // Gọi authService để tạo URL bao gồm cả state để prevent CSRF
      const { url } = await this.authService.generateAuthUrl(query.domain);

      // Redirect browser của user đến URL này
      return res.redirect(url);
    } catch (error) {
      this.logger.error('Redirect failed', error);
      throw new HttpException(
        'Failed to generate redirect URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Endpoint xử lý callback từ Bitrix24 sau khi người dùng đã cấp quyền hoặc từ chối
  @Get('callback')
  @ApiOperation({ summary: 'Handle Bitrix24 OAuth callback' })
  @ApiQuery({ name: 'code' })
  @ApiQuery({ name: 'domain' })
  @ApiQuery({ name: 'state' })
  async handleCallback(
    @Query('code') code: string,
    @Query() query: AuthDomainDto,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // Kiểm tra domain có hợp lệ và kết thúc bằng '.bitrix24.vn'
    if (!query.domain.endsWith('.bitrix24.vn')) {
      throw new BadRequestException('Invalid domain');
    }

    // Xác thực state
    const isValid = await this.authService.validateState(query.domain, state);
    if (!isValid) {
      throw new BadRequestException('Invalid state token');
    }

    // Gọi authService để đổi authorization code lấy token và tạo session token
    const { sessionToken } = await this.authService.exchangeCodeForToken(
      code,
      query.domain,
    );

    // Redirect user trở lại client với session token trong query parameter
    return res.redirect(
      `${this.config.get('CLIENT_REDIRECT_URL')}/auth/callback?session=${sessionToken}`,
    );
  }

  // Endpoint để lấy domain của Bitrix24 dựa trên memberId
  @Get('domain')
  @ApiOperation({ summary: 'Get Bitrix24 domain from member ID' })
  @ApiQuery({ name: 'memberId' })
  async getDomain(@Query('memberId') memberId: string, @Res() res: Response) {
    try {
      // Gọi authService để lấy domain
      const domain = await this.authService.getDomain(memberId);

      return res.status(200).send(domain);
    } catch (err) {
      return res.status(404).send('Domain not found');
    }
  }

  // Endpoint để lấy memberId từ session token
  @Get('member')
  @ApiOperation({ summary: 'Get memberId from session token' })
  @ApiQuery({ name: 'session' })
  async getMemberId(
    @Query('session') sessionToken: string,
    @Res() res: Response,
  ) {
    try {
      // Gọi authService để lấy memberId từ session token
      const memberId =
        await this.authService.getMemberIdFromSession(sessionToken);

      return res.status(200).json({ memberId });
    } catch (err) {
      return res.status(401).send('Invalid session');
    }
  }
}
