import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { Logger } from 'winston';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('api/leads')
@UseGuards(OAuthGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get()
  async getLeads(@Query() query: QueryLeadDto, @MemberId() memberId: string) {
    this.logger.debug(`Received getLeads request`, { memberId, query });
    if (!memberId) {
      this.logger.error(`Missing memberId in getLeads request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.getLeads(query, memberId);
    this.logger.info(`Successfully fetched leads`, {
      memberId,
      leadCount: result.leads.length,
    });
    return result;
  }

  @Get(':id')
  async getLead(@Param('id') id: string, @MemberId() memberId: string) {
    this.logger.debug(`Received getLead request`, { memberId, leadId: id });
    if (!memberId) {
      this.logger.error(`Missing memberId in getLead request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.getLead(id, memberId);
    this.logger.info(`Successfully fetched lead`, { memberId, leadId: id });
    return result;
  }

  @Post()
  async createLead(@Body() body: CreateLeadDto, @MemberId() memberId: string) {
    this.logger.debug(`Received createLead request`, { memberId, body });
    if (!memberId) {
      this.logger.error(`Missing memberId in createLead request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.createLead(body, memberId);
    this.logger.info(`Successfully created lead`, { memberId, leadId: result });
    return result;
  }

  @Patch(':id')
  async updateLead(
    @Param('id') id: string,
    @Body() body: UpdateLeadDto,
    @MemberId() memberId: string,
  ) {
    this.logger.debug(`Received updateLead request`, {
      memberId,
      leadId: id,
      body,
    });
    if (!memberId) {
      this.logger.error(`Missing memberId in updateLead request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.updateLead(id, body, memberId);
    this.logger.info(`Successfully updated lead`, { memberId, leadId: id });
    return result;
  }

  @Delete(':id')
  async deleteLead(@Param('id') id: string, @MemberId() memberId: string) {
    this.logger.debug(`Received deleteLead request`, { memberId, leadId: id });
    if (!memberId) {
      this.logger.error(`Missing memberId in deleteLead request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.deleteLead(id, memberId);
    this.logger.info(`Successfully deleted lead`, { memberId, leadId: id });
    return result;
  }

  @Get(':id/tasks')
  async getLeadTasks(@Param('id') id: string, @MemberId() memberId: string) {
    this.logger.debug(`Received getLeadTasks request`, {
      memberId,
      leadId: id,
    });
    if (!memberId) {
      this.logger.error(`Missing memberId in getLeadTasks request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.getLeadTasks(id, memberId);
    this.logger.info(`Successfully fetched tasks for lead`, {
      memberId,
      leadId: id,
      taskCount: result.length,
    });
    return result;
  }

  @Get(':id/deals')
  async getLeadDeals(@Param('id') id: string, @MemberId() memberId: string) {
    this.logger.debug(`Received getLeadDeals request`, {
      memberId,
      leadId: id,
    });
    if (!memberId) {
      this.logger.error(`Missing memberId in getLeadDeals request`);
      throw new HttpException('Member ID is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.leadsService.getLeadDeals(id, memberId);
    this.logger.info(`Successfully fetched deals for lead`, {
      memberId,
      leadId: id,
      dealCount: result.length,
    });
    return result;
  }
}
