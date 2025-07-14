import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { WebhookController } from './webhook.controller';
import { WebhookProcessor } from './webhook.processor';
import { WebhookService } from './webhook.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'webhook',
    }),
    AuthModule,
  ],
  providers: [WebhookService, WebhookProcessor, AuthService, RedisService],
  controllers: [WebhookController],
})
export class WebhookModule {}
