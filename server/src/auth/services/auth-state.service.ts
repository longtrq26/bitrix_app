import { Injectable } from '@nestjs/common';
import { RedisKeys } from 'src/common/constants/redis-key.constant';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AuthStateService {
  constructor(private readonly redisService: RedisService) {}

  // Lưu state vào Redis cho một domain cụ thể (prevent CSRF)
  async save(domain: string, state: string): Promise<void> {
    // Lưu state vào Redis với key được tạo từ domain và thời gian sống 10 phút
    await this.redisService.set(RedisKeys.state(domain), state, 600);
  }

  // Xác thực state đến với state đã lưu trong Redis cho domain đó
  async validate(domain: string, incomingState: string): Promise<boolean> {
    // Lấy state đã lưu từ Redis bằng domain
    const stored = await this.redisService.get(RedisKeys.state(domain));

    // So sánh state đã lưu với state đến
    return stored === incomingState;
  }
}
