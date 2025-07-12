import { HttpService } from '@nestjs/axios';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';

@Processor('webhook')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
  ) {}

  @Process('createTask')
  async handleCreateTask(job: Job) {
    const { lead, memberId } = job.data;
    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const task = {
      TITLE: `Follow up Lead: ${lead.TITLE}`,
      DESCRIPTION: `Contact Info:\nPhone: ${lead.PHONE}\nEmail: ${lead.EMAIL}\nSource: ${lead.SOURCE_ID}`,
      RESPONSIBLE_ID: await this.getRoundRobinUser(memberId),
      UF_CRM_TASK: [`L_${lead.ID}`],
    };

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/tasks.task.add`,
        { fields: task },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    this.logger.log(`Created task for lead ${lead.ID}`);
    return data;
  }

  @Process('createDeal')
  async handleCreateDeal(job: Job) {
    const { lead, memberId } = job.data;
    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/crm.deal.add`,
        {
          fields: {
            TITLE: `Deal for ${lead.TITLE}`,
            LEAD_ID: lead.ID,
            OPPORTUNITY: lead.OPPORTUNITY || 1000,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    this.logger.log(`Created deal for lead ${lead.ID}`);
    return data;
  }

  async getRoundRobinUser(memberId: string): Promise<number> {
    const token = await this.authService.getAccessToken(memberId);
    const domain = await this.authService.getDomain(memberId);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `https://${domain}/rest/user.get`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    const users = data.result;
    const idx = Date.now() % users.length;
    return users[idx].ID;
  }
}
