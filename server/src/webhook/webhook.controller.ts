import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { RedisService } from 'src/redis/redis.service';
import { Like, Repository } from 'typeorm';
import { Logger } from 'winston';
import { WebhookLog } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';

@Controller('api/webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly redisService: RedisService,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Post()
  async handleWebhook(@Body() body: any) {
    this.logger.debug(`Received webhook`, {
      payload: JSON.stringify(body, null, 2),
    });
    const webhookSecret = body.auth?.client_endpoint || body.auth?.access_token;
    if (!webhookSecret) {
      this.logger.error(`Missing webhook auth`);
      throw new HttpException(
        'Invalid webhook request: Missing auth',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { event, data, auth } = body;
    if (!event || !data || !auth?.member_id) {
      this.logger.error(`Invalid webhook payload`, { payload: body });
      throw new HttpException(
        'Invalid webhook payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    const memberId = auth.member_id;
    const leadId = data.ID;

    if (['ONCRMLEADADD', 'ONCRMLEADUPDATE'].includes(event)) {
      await Promise.all([
        this.redisService.delByPrefix(`leads:${memberId}:`),
        this.redisService.del(`lead:${memberId}:${leadId}`),
      ]);
      this.logger.debug(`Cleared cache for leads`, { memberId, leadId, event });
    }

    await this.webhookService.processWebhook(event, {
      ...data,
      memberId,
    });

    this.logger.info(`Webhook processed successfully`, {
      memberId,
      event,
      leadId,
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
    if (!memberId) {
      this.logger.error(`Missing memberId in getWebhookLogs request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }

    const skip = (page - 1) * limit;
    const where: any = { memberId };
    if (event) where.event = event;
    if (leadId) {
      where.payload = Like(`%"ID":"${leadId}"%`);
    }

    const [logs, total] = await this.webhookLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    this.logger.info(`Fetched webhook logs`, {
      memberId,
      logCount: logs.length,
      page,
      limit,
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
