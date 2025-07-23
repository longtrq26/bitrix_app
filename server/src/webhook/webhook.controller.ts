import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { Like, Repository } from 'typeorm';
import { WebhookLog } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';

@Controller('api/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  @Post()
  async handleWebhook(@Body() body: any) {
    this.logger.log(`Received webhook: ${JSON.stringify(body, null, 2)}`);
    const webhookSecret = body.auth?.client_endpoint || body.auth?.access_token;
    if (!webhookSecret) {
      this.logger.error('Missing webhook auth');
      throw new HttpException(
        'Invalid webhook request: Missing auth',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const { event, data, auth } = body;
    if (!event || !data || !auth?.member_id) {
      this.logger.error('Invalid webhook payload');
      throw new HttpException(
        'Invalid webhook payload',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.webhookService.processWebhook(event, {
      ...data,
      memberId: auth.member_id,
    });
    return { status: 'success', message: 'Webhook processed' };
  }

  @Get('logs')
  @UseGuards(OAuthGuard)
  async getWebhookLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('event') event: string,
    @Query('leadId') leadId: string,
    @MemberId() memberId: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { memberId };
    if (event) where.event = event;
    if (leadId) where.payload = Like(`%${leadId}%`);

    const [logs, total] = await this.webhookLogRepository.findAndCount({
      where,
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
