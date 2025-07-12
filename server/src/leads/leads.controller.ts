import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('api/leads')
@UseGuards(OAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async getLeads(
    @Query() query: QueryLeadDto,
    @Headers('x-member-id') memberId: string,
  ) {
    return this.leadsService.getLeads(query, memberId);
  }

  @Post()
  async createLead(
    @Body() body: CreateLeadDto,
    @Headers('x-member-id') memberId: string,
  ) {
    return this.leadsService.createLead(body, memberId);
  }

  @Patch(':id')
  async updateLead(
    @Param('id') id: string,
    @Body() body: UpdateLeadDto,
    @Headers('x-member-id') memberId: string,
  ) {
    return this.leadsService.updateLead(id, body, memberId);
  }

  @Delete(':id')
  async deleteLead(
    @Param('id') id: string,
    @Headers('x-member-id') memberId: string,
  ) {
    return this.leadsService.deleteLead(id, memberId);
  }
}
