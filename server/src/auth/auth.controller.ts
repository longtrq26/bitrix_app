import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('redirect')
  redirectToBitrix(@Query('domain') domain: string, @Res() res: Response) {
    const redirectUrl = this.authService.generateAuthUrl(domain);
    return res.redirect(redirectUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('domain') domain: string,
    @Res() res: Response,
  ) {
    try {
      const token = await this.authService.exchangeCodeForToken(code, domain);
      return res.status(200).json(token);
    } catch (err) {
      throw new HttpException('OAuth callback failed', HttpStatus.BAD_REQUEST);
    }
  }
}
