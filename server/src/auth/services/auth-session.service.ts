import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthSessionService {
  constructor(private readonly redisService: RedisService) {}

  // Tạo session mới
  async create(memberId: string, ttl = 600): Promise<string> {
    // Tạo session token bằng UUID v4
    const sessionToken = uuidv4();

    // Lưu sessionToken làm key và memberId làm giá trị vào Redis với thời gian sống đã cho
    await this.redisService.set(RedisKeys.session(sessionToken), memberId, ttl);

    // Trả về session token vừa tạo
    return sessionToken;
  }

  // Lấy memberId từ session token
  async getMemberId(sessionToken: string): Promise<string> {
    // Lấy memberId từ Redis sử dụng sessionToken làm key
    const memberId = await this.redisService.get(
      RedisKeys.session(sessionToken),
    );

    // Nếu session token không tồn tại hoặc đã hết hạn
    if (!memberId) throw new UnauthorizedException('Invalid session token');

    // Trả về memberId
    return memberId;
  }
}
