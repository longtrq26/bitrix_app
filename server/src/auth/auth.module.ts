import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [HttpModule],
  controllers: [AuthController],
  providers: [AuthService, RedisService],
  exports: [AuthService],
})
export class AuthModule {}
