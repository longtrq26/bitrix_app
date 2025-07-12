import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Queue } from 'bull';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { WebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
    private readonly authService: AuthService,
    private readonly httpService: HttpService,
  ) {}

  async handleLeadWebhook(payload: WebhookDto, token: string) {
    if (!this.validateToken(token)) {
      this.logger.warn('Invalid webhook token');
      throw new UnauthorizedException('Invalid webhook token');
    }

    const { event, data, memberId } = payload;
    const leadData = data.FIELDS;

    if (event === 'ONCRMLEADADD') {
      await this.webhookQueue.add('createTask', {
        lead: leadData,
        memberId: memberId,
      });
    }

    if (event === 'ONCRMLEADUPDATE' && leadData.STATUS_ID === 'CONVERTED') {
      await this.webhookQueue.add('createDeal', {
        lead: leadData,
        memberId: memberId,
      });
    }

    return { status: 'accepted' };
  }

  validateToken(token: string): boolean {
    return token === process.env.WEBHOOK_SECRET;
  }

  async getTasksForLead(leadId: string, memberId: string) {
    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/tasks.task.list`,
        { filter: { UF_CRM_TASK: [`L_${leadId}`] } },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    return data.result.tasks;
  }

  async getDealsForLead(leadId: string, memberId: string) {
    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/crm.deal.list`,
        { filter: { LEAD_ID: leadId } },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    return data.result;
  }
}
