import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

const limiter = new Bottleneck({ minTime: 500 });

@Controller('api/leads')
@UseGuards(OAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async getLeads(@Query() query: QueryLeadDto, @MemberId() memberId: string) {
    return limiter.schedule(() => this.leadsService.getLeads(query, memberId));
  }

  @Get(':id')
  async getLead(@Param('id') id: string, @MemberId() memberId: string) {
    return limiter.schedule(() => this.leadsService.getLead(id, memberId));
  }

  @Post()
  async createLead(@Body() body: CreateLeadDto, @MemberId() memberId: string) {
    return limiter.schedule(() => this.leadsService.createLead(body, memberId));
  }

  @Patch(':id')
  async updateLead(
    @Param('id') id: string,
    @Body() body: UpdateLeadDto,
    @MemberId() memberId: string,
  ) {
    return limiter.schedule(() =>
      this.leadsService.updateLead(id, body, memberId),
    );
  }

  @Delete(':id')
  async deleteLead(@Param('id') id: string, @MemberId() memberId: string) {
    return limiter.schedule(() => this.leadsService.deleteLead(id, memberId));
  }

  @Get(':id/tasks')
  async getLeadTasks(@Param('id') id: string, @MemberId() memberId: string) {
    return limiter.schedule(() => this.leadsService.getLeadTasks(id, memberId));
  }

  @Get(':id/deals')
  async getLeadDeals(@Param('id') id: string, @MemberId() memberId: string) {
    return limiter.schedule(() => this.leadsService.getLeadDeals(id, memberId));
  }
}
