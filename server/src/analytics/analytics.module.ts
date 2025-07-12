import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { RedisService } from 'src/redis/redis.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, RedisService],
})
export class AnalyticsModule {}
