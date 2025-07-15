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
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { MemberId } from 'src/common/decorators/member-id.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('api/leads')
@UseGuards(OAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of leads with filtering and sorting' })
  @ApiQuery({ type: QueryLeadDto })
  @ApiResponse({ status: 200, description: 'List of leads and custom fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getLeads(@Query() query: QueryLeadDto, @MemberId() memberId: string) {
    return this.leadsService.getLeads(query, memberId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiBody({ type: CreateLeadDto })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createLead(@Body() body: CreateLeadDto, @MemberId() memberId: string) {
    return this.leadsService.createLead(body, memberId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing lead' })
  @ApiBody({ type: UpdateLeadDto })
  @ApiResponse({ status: 200, description: 'Lead updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async updateLead(
    @Param('id') id: string,
    @Body() body: UpdateLeadDto,
    @MemberId() memberId: string,
  ) {
    return this.leadsService.updateLead(id, body, memberId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a lead' })
  @ApiResponse({ status: 200, description: 'Lead deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid lead ID' })
  async deleteLead(@Param('id') id: string, @MemberId() memberId: string) {
    return this.leadsService.deleteLead(id, memberId);
  }
}
