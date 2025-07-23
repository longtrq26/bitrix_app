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

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookLog]),
    HttpModule,
    AuthModule,
    RedisModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'webhook',
    }),
  ],
  providers: [WebhookService, WebhookProcessor],
  controllers: [WebhookController],
})
export class WebhookModule {}
