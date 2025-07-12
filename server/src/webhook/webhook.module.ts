import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { WebhookController } from './webhook.controller';
import { WebhookProcessor } from './webhook.processor';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'webhook',
    }),
  ],
  providers: [WebhookService, WebhookProcessor, AuthService, RedisService],
  controllers: [WebhookController],
})
export class WebhookModule {}
