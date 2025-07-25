import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

const mockAuthService = {
  ensureValidAccessToken: jest.fn(),
  getMemberIdFromSession: jest.fn(),
};

const mockLeadsService = {
  getLeads: jest.fn(),
  getLead: jest.fn(),
  createLead: jest.fn(),
  updateLead: jest.fn(),
  deleteLead: jest.fn(),
  getLeadTasks: jest.fn(),
  getLeadDeals: jest.fn(),
};

describe('LeadsController', () => {
  let controller: LeadsController;
  let leadsService: LeadsService; // Sửa kiểu thành LeadsService thay vì jest.Mocked<LeadsService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: mockLeadsService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
    leadsService = module.get<LeadsService>(LeadsService) as any; // Ép kiểu để tránh lỗi TypeScript
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLeads', () => {
    it('should return leads for valid memberId and query', async () => {
      const query: QueryLeadDto = { page: 1, limit: 10 };
      const memberId = 'mem01';
      const result = { leads: [{ id: 'lead1' }], total: 1 };
      mockLeadsService.getLeads.mockResolvedValue(result);

      const response = await controller.getLeads(query, memberId);

      expect(mockLeadsService.getLeads).toHaveBeenCalledWith(query, memberId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received getLeads request',
        { memberId, query },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully fetched leads',
        {
          memberId,
          leadCount: result.leads.length,
        },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const query: QueryLeadDto = { page: 1, limit: 10 };

      await expect(controller.getLeads(query, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in getLeads request',
      );
    });
  });

  describe('getLead', () => {
    it('should return a lead for valid id and memberId', async () => {
      const leadId = 'lead1';
      const memberId = 'mem01';
      const result = { id: leadId, TITLE: 'Test Lead' }; // Sử dụng TITLE thay vì title
      mockLeadsService.getLead.mockResolvedValue(result);

      const response = await controller.getLead(leadId, memberId);

      expect(mockLeadsService.getLead).toHaveBeenCalledWith(leadId, memberId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received getLead request',
        { memberId, leadId },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully fetched lead',
        { memberId, leadId },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const leadId = 'lead1';

      await expect(controller.getLead(leadId, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in getLead request',
      );
    });
  });

  describe('createLead', () => {
    it('should create and return a lead for valid input', async () => {
      const body: CreateLeadDto = { TITLE: 'New Lead' }; // Sửa title thành TITLE
      const memberId = 'mem01';
      const result = 'lead1';
      mockLeadsService.createLead.mockResolvedValue(result);

      const response = await controller.createLead(body, memberId);

      expect(mockLeadsService.createLead).toHaveBeenCalledWith(body, memberId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received createLead request',
        { memberId, body },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully created lead',
        { memberId, leadId: result },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const body: CreateLeadDto = { TITLE: 'New Lead' }; // Sửa title thành TITLE

      await expect(controller.createLead(body, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in createLead request',
      );
    });
  });

  describe('updateLead', () => {
    it('should update and return a lead for valid input', async () => {
      const leadId = 'lead1';
      const body: UpdateLeadDto = { TITLE: 'Updated Lead' }; // Sửa title thành TITLE
      const memberId = 'mem01';
      const result = { id: leadId, TITLE: 'Updated Lead' };
      mockLeadsService.updateLead.mockResolvedValue(result);

      const response = await controller.updateLead(leadId, body, memberId);

      expect(mockLeadsService.updateLead).toHaveBeenCalledWith(
        leadId,
        body,
        memberId,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received updateLead request',
        { memberId, leadId, body },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully updated lead',
        { memberId, leadId },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const leadId = 'lead1';
      const body: UpdateLeadDto = { TITLE: 'Updated Lead' }; // Sửa title thành TITLE

      await expect(controller.updateLead(leadId, body, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in updateLead request',
      );
    });
  });

  describe('deleteLead', () => {
    it('should delete a lead for valid input', async () => {
      const leadId = 'lead1';
      const memberId = 'mem01';
      const result = { success: true };
      mockLeadsService.deleteLead.mockResolvedValue(result);

      const response = await controller.deleteLead(leadId, memberId);

      expect(mockLeadsService.deleteLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received deleteLead request',
        { memberId, leadId },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully deleted lead',
        { memberId, leadId },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const leadId = 'lead1';

      await expect(controller.deleteLead(leadId, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in deleteLead request',
      );
    });
  });

  describe('getLeadTasks', () => {
    it('should return tasks for a lead', async () => {
      const leadId = 'lead1';
      const memberId = 'mem01';
      const result = [{ id: 'task1' }, { id: 'task2' }];
      mockLeadsService.getLeadTasks.mockResolvedValue(result);

      const response = await controller.getLeadTasks(leadId, memberId);

      expect(mockLeadsService.getLeadTasks).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received getLeadTasks request',
        { memberId, leadId },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully fetched tasks for lead',
        {
          memberId,
          leadId,
          taskCount: result.length,
        },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const leadId = 'lead1';

      await expect(controller.getLeadTasks(leadId, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in getLeadTasks request',
      );
    });
  });

  describe('getLeadDeals', () => {
    it('should return deals for a lead', async () => {
      const leadId = 'lead1';
      const memberId = 'mem01';
      const result = [{ id: 'deal1' }, { id: 'deal2' }];
      mockLeadsService.getLeadDeals.mockResolvedValue(result);

      const response = await controller.getLeadDeals(leadId, memberId);

      expect(mockLeadsService.getLeadDeals).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received getLeadDeals request',
        { memberId, leadId },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully fetched deals for lead',
        {
          memberId,
          leadId,
          dealCount: result.length,
        },
      );
      expect(response).toEqual(result);
    });

    it('should throw HttpException if memberId is missing', async () => {
      const leadId = 'lead1';

      await expect(controller.getLeadDeals(leadId, '')).rejects.toThrow(
        new HttpException('Member ID is required', HttpStatus.BAD_REQUEST),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Missing memberId in getLeadDeals request',
      );
    });
  });
});
