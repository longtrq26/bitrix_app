import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class WebhookService {
  constructor(
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async processWebhook(event: string, data: any) {
    if (!data.memberId) {
      this.logger.error(`Missing memberId in webhook data`, { event, data });
      throw new Error('Missing memberId in webhook data');
    }

    const leadId = data.ID || 'N/A';
    try {
      this.logger.debug(`Queuing webhook: ${event} for lead ${leadId}`, {
        memberId: data.memberId,
      });

      await this.webhookQueue.add('handle-lead-webhook', {
        event,
        data,
        memberId: data.memberId,
      });

      this.logger.info(`Webhook queued successfully`, {
        memberId: data.memberId,
        event,
        leadId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue webhook ${event} for lead ${leadId}: ${error.message}`,
        { memberId: data.memberId, error },
      );
      throw error;
    }
  }
}
