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

  // Method bắt buộc của interface CanActivate, gọi để xác định quyền truy cập
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Lấy request từ HTTP context
    const request = context.switchToHttp().getRequest();
    // Lấy memberId từ header 'x-member-id' của request
    const memberId = request.headers['x-member-id'];

    // Kiểm tra memberId có tồn tại và là string
    if (!memberId || typeof memberId !== 'string') {
      throw new HttpException('Missing member id', HttpStatus.UNAUTHORIZED);
    }

    // Gọi ensureValidAccessToken từ AuthService để xác thực accessToken dựa trên memberId
    const accessToken = await this.authService.ensureValidAccessToken(memberId);
    // Nếu không lấy được accessToken hợp lệ
    if (!accessToken) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Gán accessToken vào thuộc tính bitrixAccessToken của đối tượng request
    // Giúp các controller hoặc service sau này có thể truy cập accessToken
    request.bitrixAccessToken = accessToken;

    // Return true, cho phép yêu cầu tiếp tục xử lý
    return true;
  }
}
