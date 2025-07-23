import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis/redis.module';
import { WebhookLog } from './entities/webhook.entity';
import { WebhookController } from './webhook.controller';
import { WebhookProcessor } from './webhook.processor';
import { WebhookService } from './webhook.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([WebhookLog]),
    HttpModule,
    AuthModule,
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'webhook',
    }),
  ],
  providers: [WebhookService, WebhookProcessor],
  controllers: [WebhookController],
})
export class WebhookModule {}
