import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async processWebhook(event: string, data: any) {
    try {
      this.logger.log(
        `Webhook queued for processing: ${event}, memberId: ${data.memberId}`,
      );
      await this.webhookQueue.add('handle-lead-webhook', {
        event,
        data,
        memberId: data.memberId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
