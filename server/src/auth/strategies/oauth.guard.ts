import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class OAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const memberId = request.headers['x-member-id'];

    if (!memberId || typeof memberId !== 'string') {
      throw new HttpException('Missing member id', HttpStatus.UNAUTHORIZED);
    }

    const accessToken = await this.authService.ensureValidAccessToken(memberId);

    if (!accessToken) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    request.bitrixAccessToken = accessToken;

    return true;
  }
}
