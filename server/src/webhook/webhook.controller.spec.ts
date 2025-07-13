import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

class MockWebhookDto {
  event: string;
  data: {
    FIELDS: Record<string, any>;
  };
  auth: string;
  memberId: string;
}

describe('WebhookController', () => {
  let controller: WebhookController;

  const mockWebhookService = {
    handleLeadWebhook: jest.fn(),
    getTasksForLead: jest.fn(),
    getDealsForLead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    const validToken = 'valid_token';
    const mockWebhookDto: MockWebhookDto = {
      event: 'ONCRMLEADADD',
      data: {
        FIELDS: {
          ID: '123',
          TITLE: 'Test Lead',
          STATUS_ID: 'NEW',
        },
      },
      auth: 'test_auth',
      memberId: 'test_member_id',
    };

    it('should call webhookService.handleLeadWebhook with correct parameters', async () => {
      const expectedResult = { status: 'accepted' };
      mockWebhookService.handleLeadWebhook.mockResolvedValue(expectedResult);

      const result = await controller.handleWebhook(mockWebhookDto, validToken);

      expect(mockWebhookService.handleLeadWebhook).toHaveBeenCalledWith(
        mockWebhookDto,
        validToken,
      );
      expect(mockWebhookService.handleLeadWebhook).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service throwing UnauthorizedException', async () => {
      mockWebhookService.handleLeadWebhook.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      await expect(
        controller.handleWebhook(mockWebhookDto, 'invalid_token'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockWebhookService.handleLeadWebhook).toHaveBeenCalledWith(
        mockWebhookDto,
        'invalid_token',
      );
    });

    it('should handle service throwing generic error', async () => {
      const error = new Error('Service error');
      mockWebhookService.handleLeadWebhook.mockRejectedValue(error);

      await expect(
        controller.handleWebhook(mockWebhookDto, validToken),
      ).rejects.toThrow('Service error');
      expect(mockWebhookService.handleLeadWebhook).toHaveBeenCalledWith(
        mockWebhookDto,
        validToken,
      );
    });

    it('should handle missing token header', async () => {
      const expectedResult = { status: 'accepted' };
      mockWebhookService.handleLeadWebhook.mockResolvedValue(expectedResult);

      const result = await controller.handleWebhook(
        mockWebhookDto,
        undefined as any,
      );

      expect(mockWebhookService.handleLeadWebhook).toHaveBeenCalledWith(
        mockWebhookDto,
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getTasks', () => {
    const leadId = '123';
    const memberId = 'test_member_id';
    const mockTasks = [
      { id: 'task1', title: 'Task 1' },
      { id: 'task2', title: 'Task 2' },
    ];

    it('should call webhookService.getTasksForLead with correct parameters', async () => {
      mockWebhookService.getTasksForLead.mockResolvedValue(mockTasks);

      const result = await controller.getTasks(leadId, memberId);

      expect(mockWebhookService.getTasksForLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(mockWebhookService.getTasksForLead).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTasks);
    });

    it('should handle service throwing error', async () => {
      const error = new Error('Failed to fetch tasks');
      mockWebhookService.getTasksForLead.mockRejectedValue(error);

      await expect(controller.getTasks(leadId, memberId)).rejects.toThrow(
        'Failed to fetch tasks',
      );
      expect(mockWebhookService.getTasksForLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
    });

    it('should handle empty tasks result', async () => {
      mockWebhookService.getTasksForLead.mockResolvedValue([]);

      const result = await controller.getTasks(leadId, memberId);

      expect(mockWebhookService.getTasksForLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(result).toEqual([]);
    });

    it('should handle missing memberId query parameter', async () => {
      mockWebhookService.getTasksForLead.mockResolvedValue(mockTasks);

      const result = await controller.getTasks(leadId, undefined as any);

      expect(mockWebhookService.getTasksForLead).toHaveBeenCalledWith(
        leadId,
        undefined,
      );
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getDeals', () => {
    const leadId = '123';
    const memberId = 'test_member_id';
    const mockDeals = {
      deals: [
        { id: 'deal1', title: 'Deal 1' },
        { id: 'deal2', title: 'Deal 2' },
      ],
    };

    it('should call webhookService.getDealsForLead with correct parameters', async () => {
      mockWebhookService.getDealsForLead.mockResolvedValue(mockDeals);

      const result = await controller.getDeals(leadId, memberId);

      expect(mockWebhookService.getDealsForLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(mockWebhookService.getDealsForLead).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockDeals);
    });

    it('should handle service throwing error', async () => {
      const error = new Error('Failed to fetch deals');
      mockWebhookService.getDealsForLead.mockRejectedValue(error);

      await expect(controller.getDeals(leadId, memberId)).rejects.toThrow(
        'Failed to fetch deals',
      );
      expect(mockWebhookService.getDealsForLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
    });

    it('should handle empty deals result', async () => {
      const emptyResult = { deals: [] };
      mockWebhookService.getDealsForLead.mockResolvedValue(emptyResult);

      const result = await controller.getDeals(leadId, memberId);

      expect(mockWebhookService.getDealsForLead).toHaveBeenCalledWith(
        leadId,
        memberId,
      );
      expect(result).toEqual(emptyResult);
    });

    it('should handle missing memberId query parameter', async () => {
      mockWebhookService.getDealsForLead.mockResolvedValue(mockDeals);

      const result = await controller.getDeals(leadId, undefined as any);

      expect(mockWebhookService.getDealsForLead).toHaveBeenCalledWith(
        leadId,
        undefined,
      );
      expect(result).toEqual(mockDeals);
    });
  });
});
