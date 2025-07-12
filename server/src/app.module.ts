import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { LeadsModule } from './leads/leads.module';
import { LoggerModule } from './logger/logger.module';
import { RedisService } from './redis/redis.service';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    LoggerModule,
    AuthModule,
    LeadsModule,
    WebhookModule,
    AnalyticsModule,
  ],
  controllers: [AuthController],
  providers: [RedisService, AuthService],
})
export class AppModule {}
