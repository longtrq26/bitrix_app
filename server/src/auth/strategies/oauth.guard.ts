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

    if (!memberId) {
      throw new HttpException('Missing member id', HttpStatus.UNAUTHORIZED);
    }

    let token = await this.authService.getAccessToken(memberId);
    if (!token) {
      const tokenData = await this.authService.getTokenData(memberId);
      if (tokenData && tokenData.refresh_token) {
        token = await this.authService.refreshAccessToken(
          tokenData.refresh_token,
          memberId,
        );
      } else {
        throw new HttpException('Token not found', HttpStatus.UNAUTHORIZED);
      }
    }

    request.bitrixAccessToken = token;
    return true;
  }
}
