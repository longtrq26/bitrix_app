import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { AuthService } from '../auth/auth.service'; // Adjust import path as needed
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';

describe('LeadsController', () => {
  let controller: LeadsController;
  let service: LeadsService;

  const mockLeadsService = {
    getLeads: jest.fn(),
    createLead: jest.fn(),
    updateLead: jest.fn(),
    deleteLead: jest.fn(),
  };

  // Mock AuthService
  const mockAuthService = {
    validateToken: jest.fn(),
    getUser: jest.fn(),
    // Add any other methods that OAuthGuard might use
  };

  const mockMemberId = 'test-member-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: mockLeadsService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
    service = module.get<LeadsService>(LeadsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLeads', () => {
    it('should return leads with default query parameters', async () => {
      const mockResponse = {
        leads: [],
        fields: {},
        statuses: [],
        sources: [],
      };
      mockLeadsService.getLeads.mockResolvedValue(mockResponse);

      const query: QueryLeadDto = {};
      const result = await controller.getLeads(query, mockMemberId);

      expect(service.getLeads).toHaveBeenCalledWith(query, mockMemberId);
      expect(result).toEqual(mockResponse);
    });

    it('should return leads with all query parameters', async () => {
      const mockResponse = {
        leads: [{ id: '1', TITLE: 'Test Lead' }],
        fields: { TITLE: 'string' },
        statuses: [{ id: '1', name: 'New' }],
        sources: [{ id: '1', name: 'Website' }],
      };
      mockLeadsService.getLeads.mockResolvedValue(mockResponse);

      const query: QueryLeadDto = {
        find: 'test',
        status: 'new',
        source: 'website',
        sort: 'DATE_CREATE',
        date: '2024-01-01',
        domain: 'example.com',
      };
      const result = await controller.getLeads(query, mockMemberId);

      expect(service.getLeads).toHaveBeenCalledWith(query, mockMemberId);
      expect(result).toEqual(mockResponse);
    });

    it('should handle service errors', async () => {
      mockLeadsService.getLeads.mockRejectedValue(new Error('Service error'));

      const query: QueryLeadDto = {};
      await expect(controller.getLeads(query, mockMemberId)).rejects.toThrow(
        'Service error',
      );
    });
  });

  describe('createLead', () => {
    it('should create a lead successfully', async () => {
      const mockResponse = { id: '1', TITLE: 'New Lead' };
      mockLeadsService.createLead.mockResolvedValue(mockResponse);

      const createLeadDto: CreateLeadDto = {
        TITLE: 'New Lead',
        EMAIL: 'test@example.com',
        PHONE: '1234567890',
        STATUS_ID: '1',
        SOURCE_ID: '1',
        COMMENTS: 'Test comments',
        domain: 'example.com',
        customFields: { field1: 'value1' },
      };

      const result = await controller.createLead(createLeadDto, mockMemberId);

      expect(service.createLead).toHaveBeenCalledWith(
        createLeadDto,
        mockMemberId,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should create a lead with minimal required fields', async () => {
      const mockResponse = { id: '1', TITLE: 'Minimal Lead' };
      mockLeadsService.createLead.mockResolvedValue(mockResponse);

      const createLeadDto: CreateLeadDto = {
        TITLE: 'Minimal Lead',
        domain: 'example.com',
      };

      const result = await controller.createLead(createLeadDto, mockMemberId);

      expect(service.createLead).toHaveBeenCalledWith(
        createLeadDto,
        mockMemberId,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle service errors during creation', async () => {
      mockLeadsService.createLead.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      const createLeadDto: CreateLeadDto = {
        TITLE: 'New Lead',
        domain: 'example.com',
      };

      await expect(
        controller.createLead(createLeadDto, mockMemberId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateLead', () => {
    it('should update a lead successfully', async () => {
      const mockResponse = { id: '1', TITLE: 'Updated Lead' };
      mockLeadsService.updateLead.mockResolvedValue(mockResponse);

      const updateLeadDto: UpdateLeadDto = {
        TITLE: 'Updated Lead',
        EMAIL: 'updated@example.com',
      };

      const result = await controller.updateLead(
        '1',
        updateLeadDto,
        mockMemberId,
      );

      expect(service.updateLead).toHaveBeenCalledWith(
        '1',
        updateLeadDto,
        mockMemberId,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should update a lead with partial data', async () => {
      const mockResponse = { id: '1', TITLE: 'Partially Updated Lead' };
      mockLeadsService.updateLead.mockResolvedValue(mockResponse);

      const updateLeadDto: UpdateLeadDto = {
        COMMENTS: 'Updated comments only',
      };

      const result = await controller.updateLead(
        '1',
        updateLeadDto,
        mockMemberId,
      );

      expect(service.updateLead).toHaveBeenCalledWith(
        '1',
        updateLeadDto,
        mockMemberId,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle service errors during update', async () => {
      mockLeadsService.updateLead.mockRejectedValue(
        new BadRequestException('Lead not found'),
      );

      const updateLeadDto: UpdateLeadDto = {
        TITLE: 'Updated Lead',
      };

      await expect(
        controller.updateLead('invalid-id', updateLeadDto, mockMemberId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteLead', () => {
    it('should delete a lead successfully', async () => {
      const mockResponse = { message: 'Lead deleted successfully' };
      mockLeadsService.deleteLead.mockResolvedValue(mockResponse);

      const result = await controller.deleteLead('1', mockMemberId);

      expect(service.deleteLead).toHaveBeenCalledWith('1', mockMemberId);
      expect(result).toEqual(mockResponse);
    });

    it('should handle service errors during deletion', async () => {
      mockLeadsService.deleteLead.mockRejectedValue(
        new BadRequestException('Lead not found'),
      );

      await expect(
        controller.deleteLead('invalid-id', mockMemberId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

// DTO validation tests remain the same...
describe('CreateLeadDto', () => {
  it('should validate a valid CreateLeadDto', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
      EMAIL: 'test@example.com',
      PHONE: '1234567890',
      STATUS_ID: '1',
      SOURCE_ID: '1',
      COMMENTS: 'Valid comments',
      domain: 'example.com',
      customFields: { field1: 'value1' },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with minimal required fields', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Minimal Lead',
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when TITLE is missing', async () => {
    const dto = plainToClass(CreateLeadDto, {
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('TITLE');
  });

  it('should fail validation when TITLE is empty', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: '',
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('TITLE');
  });

  it('should fail validation when TITLE is too long', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'a'.repeat(101),
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('TITLE');
  });

  it('should fail validation when EMAIL is invalid', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
      EMAIL: 'invalid-email',
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('EMAIL');
  });

  it('should fail validation when domain is missing', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('domain');
  });

  it('should fail validation when domain is empty', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
      domain: '',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('domain');
  });

  it('should fail validation when COMMENTS is too long', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
      COMMENTS: 'a'.repeat(1001),
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('COMMENTS');
  });

  it('should pass validation when COMMENTS is at maximum length', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
      COMMENTS: 'a'.repeat(1000),
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when TITLE is not a string', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 123,
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('TITLE');
  });

  it('should fail validation when customFields is not an object', async () => {
    const dto = plainToClass(CreateLeadDto, {
      TITLE: 'Valid Lead',
      domain: 'example.com',
      customFields: 'not-an-object',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('customFields');
  });
});

describe('UpdateLeadDto', () => {
  it('should validate a valid UpdateLeadDto', async () => {
    const dto = plainToClass(UpdateLeadDto, {
      TITLE: 'Updated Lead',
      EMAIL: 'updated@example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with empty UpdateLeadDto', async () => {
    const dto = plainToClass(UpdateLeadDto, {});

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when EMAIL is invalid', async () => {
    const dto = plainToClass(UpdateLeadDto, {
      EMAIL: 'invalid-email',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('EMAIL');
  });

  it('should fail validation when TITLE is too long', async () => {
    const dto = plainToClass(UpdateLeadDto, {
      TITLE: 'a'.repeat(101),
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('TITLE');
  });
});

describe('QueryLeadDto', () => {
  it('should validate a valid QueryLeadDto', async () => {
    const dto = plainToClass(QueryLeadDto, {
      find: 'test',
      status: 'new',
      source: 'website',
      sort: 'DATE_CREATE',
      date: '2024-01-01',
      domain: 'example.com',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with empty QueryLeadDto', async () => {
    const dto = plainToClass(QueryLeadDto, {});

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when find is not a string', async () => {
    const dto = plainToClass(QueryLeadDto, {
      find: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('find');
  });

  it('should fail validation when status is not a string', async () => {
    const dto = plainToClass(QueryLeadDto, {
      status: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
  });

  it('should fail validation when source is not a string', async () => {
    const dto = plainToClass(QueryLeadDto, {
      source: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('source');
  });

  it('should fail validation when sort is not a string', async () => {
    const dto = plainToClass(QueryLeadDto, {
      sort: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sort');
  });

  it('should fail validation when date is not a string', async () => {
    const dto = plainToClass(QueryLeadDto, {
      date: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('date');
  });

  it('should fail validation when domain is not a string', async () => {
    const dto = plainToClass(QueryLeadDto, {
      domain: 123,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('domain');
  });
});
