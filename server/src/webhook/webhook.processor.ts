import { HttpService } from '@nestjs/axios';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { WebhookLog } from 'src/webhook/entities/webhook.entity';
import { Repository } from 'typeorm';

@Processor('webhook')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  @Process('handle-lead-webhook')
  async handleLeadWebhook(
    job: Job<{ memberId: string; event: string; data: any }>,
  ) {
    const { memberId, event, data } = job.data;
    const leadId = data.ID;

    this.logger.log(
      `Processing webhook: ${event} for lead ${leadId}, memberId: ${memberId}`,
    );

    const log = this.webhookLogRepository.create({
      event,
      payload: JSON.stringify(data),
      memberId,
      createdAt: new Date(),
    });

    await this.webhookLogRepository.save(log);

    const fetchWithRetry = async <T>(
      url: string,
      options: any,
      action: string,
    ): Promise<T> => {
      let token = await this.authService.getAccessToken(memberId);
      const domain = await this.authService.getDomain(memberId);

      try {
        const response = await firstValueFrom(
          this.httpService.request({
            ...options,
            url: `https://${domain}${url}`,
            headers: { Authorization: `Bearer ${token}`, ...options.headers },
          }),
        );
        return response.data.result;
      } catch (error) {
        if (error.response?.status === 401) {
          this.logger.warn(`Retrying ${action} due to 401 for lead ${leadId}`);
          token = await this.authService.refreshToken(memberId);
          const retryResponse = await firstValueFrom(
            this.httpService.request({
              ...options,
              url: `https://${domain}${url}`,
              headers: { Authorization: `Bearer ${token}`, ...options.headers },
            }),
          );
          return retryResponse.data.result;
        }
        this.logger.error(`Failed ${action}: ${error.message}`, error.stack);
        throw error;
      }
    };

    try {
      if (event === 'ONCRMLEADADD') {
        const lead = await fetchWithRetry<any>(
          `/rest/crm.lead.get?id=${leadId}`,
          { method: 'GET' },
          'fetch lead',
        );

        const users = await fetchWithRetry<any[]>(
          `/rest/user.get`,
          { method: 'GET' },
          'fetch users',
        );
        const responsibleId = await this.roundRobin(users);

        await fetchWithRetry(
          `/rest/tasks.task.add`,
          {
            method: 'POST',
            data: {
              fields: {
                TITLE: `Follow up Lead: ${lead.TITLE}`,
                DESCRIPTION: `Phone: ${lead.PHONE?.[0]?.VALUE || ''}, Email: ${lead.EMAIL?.[0]?.VALUE || ''}, Source: ${lead.SOURCE_ID}`,
                RESPONSIBLE_ID: responsibleId,
                UF_CRM_TASK: `L_${leadId}`,
              },
            },
          },
          'create task',
        );

        await fetchWithRetry(
          `/rest/im.notify`,
          {
            method: 'POST',
            data: {
              to: responsibleId,
              message: `New lead assigned: ${lead.TITLE}`,
              type: 'SYSTEM',
            },
          },
          'send notification',
        );

        this.logger.log(`Created task and notification for lead ${leadId}`);
      } else if (
        event === 'ONCRMLEADUPDATE' &&
        data.STATUS_ID === 'CONVERTED'
      ) {
        await fetchWithRetry(
          `/rest/crm.deal.add`,
          {
            method: 'POST',
            data: {
              fields: {
                TITLE: `Deal from Lead: ${data.TITLE}`,
                LEAD_ID: leadId,
              },
            },
          },
          'create deal',
        );
        this.logger.log(`Created deal for converted lead ${leadId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process webhook ${event} for lead ${leadId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async roundRobin(users: any[]): Promise<number> {
    const redisKey = 'round-robin:last-user';
    const lastIndex = parseInt(
      (await this.redisService.get(redisKey)) || '0',
      10,
    );
    const nextIndex = (lastIndex + 1) % users.length;

    this.logger.log(
      `Users: ${JSON.stringify(users)}, Selected index: ${nextIndex}`,
    );

    await this.redisService.set(redisKey, nextIndex.toString(), 60);
    return users[nextIndex].ID;
  }
}
