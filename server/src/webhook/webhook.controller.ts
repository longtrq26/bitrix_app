import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { Repository } from 'typeorm';
import { WebhookLog } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';

@Controller('api/webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  @Post()
  async handleWebhook(@Body() body: any) {
    const webhookSecret = body.auth?.client_endpoint || body.auth?.access_token;
    if (!webhookSecret) {
      throw new HttpException(
        'Invalid webhook request: Missing auth',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const event = body.event;
    const data = body.data;
    const memberId = body.auth?.member_id;
    if (!event || !data || !memberId) {
      throw new HttpException(
        'Invalid webhook payload',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.webhookService.processWebhook(event, { ...data, memberId });
    return { status: 'success', message: 'Webhook processed' };
  }

  @Get('logs')
  @UseGuards(OAuthGuard)
  async getWebhookLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @MemberId() memberId: string,
  ) {
    const skip = (page - 1) * limit;
    const [logs, total] = await this.webhookLogRepository.findAndCount({
      where: { memberId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
