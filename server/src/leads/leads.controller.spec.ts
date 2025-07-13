import { Test, TestingModule } from '@nestjs/testing';
import { OAuthGuard } from 'src/auth/strategies/oauth.guard';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

class MockQueryLeadDto {
  search?: string;
  status?: string;
  source?: string;
  sort?: string;
  domain?: string;
}

class MockCreateLeadDto {
  TITLE: string;
  EMAIL?: string;
  PHONE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  COMMENTS?: string;
  domain: string;
}

class MockUpdateLeadDto {
  TITLE?: string;
  EMAIL?: string;
  PHONE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  COMMENTS?: string;
  domain: string;
}

describe('LeadsController', () => {
  let controller: LeadsController;

  const mockLeadsService = {
    getLeads: jest.fn(),
    createLead: jest.fn(),
    updateLead: jest.fn(),
    deleteLead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: mockLeadsService,
        },
      ],
    })
      .overrideGuard(OAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    controller = module.get<LeadsController>(LeadsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLeads', () => {
    it('should call leadsService.getLeads and return the result', async () => {
      const mockQuery: MockQueryLeadDto = {
        domain: 'test.bitrix24.com',
        search: 'Test',
        status: 'NEW',
      };
      const mockMemberId = 'testMemberId';
      const expectedResult = [
        { ID: '1', TITLE: 'Test Lead 1' },
        { ID: '2', TITLE: 'Test Lead 2' },
      ];

      mockLeadsService.getLeads.mockResolvedValue(expectedResult);

      const result = await controller.getLeads(mockQuery, mockMemberId);

      expect(mockLeadsService.getLeads).toHaveBeenCalledWith(
        mockQuery,
        mockMemberId,
      );
      expect(mockLeadsService.getLeads).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const mockQuery: MockQueryLeadDto = {};
      const mockMemberId = 'testMemberId';
      const expectedResult = [];

      mockLeadsService.getLeads.mockResolvedValue(expectedResult);

      const result = await controller.getLeads(mockQuery, mockMemberId);

      expect(mockLeadsService.getLeads).toHaveBeenCalledWith(
        mockQuery,
        mockMemberId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createLead', () => {
    it('should call leadsService.createLead and return the result', async () => {
      const mockBody: MockCreateLeadDto = {
        TITLE: 'New Lead',
        EMAIL: 'test@example.com',
        PHONE: '123456789',
        domain: 'test.bitrix24.com',
      };
      const mockMemberId = 'testMemberId';
      const expectedResult = { ID: '3', TITLE: 'New Lead' };

      mockLeadsService.createLead.mockResolvedValue(expectedResult);

      const result = await controller.createLead(mockBody, mockMemberId);

      expect(mockLeadsService.createLead).toHaveBeenCalledWith(
        mockBody,
        mockMemberId,
      );
      expect(mockLeadsService.createLead).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle minimal required fields', async () => {
      const mockBody: MockCreateLeadDto = {
        TITLE: 'Minimal Lead',
        domain: 'test.bitrix24.com',
      };
      const mockMemberId = 'testMemberId';
      const expectedResult = { ID: '4', TITLE: 'Minimal Lead' };

      mockLeadsService.createLead.mockResolvedValue(expectedResult);

      const result = await controller.createLead(mockBody, mockMemberId);

      expect(mockLeadsService.createLead).toHaveBeenCalledWith(
        mockBody,
        mockMemberId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateLead', () => {
    it('should call leadsService.updateLead and return the result', async () => {
      const mockId = '1';
      const mockBody: MockUpdateLeadDto = {
        TITLE: 'Updated Lead',
        STATUS_ID: 'CONVERTED',
        domain: 'test.bitrix24.com',
      };
      const mockMemberId = 'testMemberId';
      const expectedResult = { success: true, ID: '1' };

      mockLeadsService.updateLead.mockResolvedValue(expectedResult);

      const result = await controller.updateLead(
        mockId,
        mockBody,
        mockMemberId,
      );

      expect(mockLeadsService.updateLead).toHaveBeenCalledWith(
        mockId,
        mockBody,
        mockMemberId,
      );
      expect(mockLeadsService.updateLead).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle partial updates', async () => {
      const mockId = '1';
      const mockBody: MockUpdateLeadDto = {
        STATUS_ID: 'QUALIFIED',
        domain: 'test.bitrix24.com',
      };
      const mockMemberId = 'testMemberId';
      const expectedResult = { success: true, ID: '1' };

      mockLeadsService.updateLead.mockResolvedValue(expectedResult);

      const result = await controller.updateLead(
        mockId,
        mockBody,
        mockMemberId,
      );

      expect(mockLeadsService.updateLead).toHaveBeenCalledWith(
        mockId,
        mockBody,
        mockMemberId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteLead', () => {
    it('should call leadsService.deleteLead and return the result', async () => {
      const mockId = '1';
      const mockMemberId = 'testMemberId';
      const expectedResult = { success: true, ID: '1' };

      mockLeadsService.deleteLead.mockResolvedValue(expectedResult);

      const result = await controller.deleteLead(mockId, mockMemberId);

      expect(mockLeadsService.deleteLead).toHaveBeenCalledWith(
        mockId,
        mockMemberId,
      );
      expect(mockLeadsService.deleteLead).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle different id formats', async () => {
      const mockId = '999';
      const mockMemberId = 'testMemberId';
      const expectedResult = { success: true, ID: '999' };

      mockLeadsService.deleteLead.mockResolvedValue(expectedResult);

      const result = await controller.deleteLead(mockId, mockMemberId);

      expect(mockLeadsService.deleteLead).toHaveBeenCalledWith(
        mockId,
        mockMemberId,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
