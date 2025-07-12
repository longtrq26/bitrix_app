import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { WebhookDto } from './dto/webhook.dto';
import { WebhookService } from './webhook.service';

@Controller('api/webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('lead')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: WebhookDto,
    @Headers('X-Hook-Token') token: string,
  ) {
    return this.webhookService.handleLeadWebhook(body, token);
  }

  @Get('/leads/:id/tasks')
  async getTasks(@Param('id') id: string, @Query('memberId') memberId: string) {
    return this.webhookService.getTasksForLead(id, memberId);
  }

  @Get('/leads/:id/deals')
  async getDeals(@Param('id') id: string, @Query('memberId') memberId: string) {
    return this.webhookService.getDealsForLead(id, memberId);
  }
}
