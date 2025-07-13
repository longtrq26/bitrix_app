import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;

  // Mock implementation for AnalyticsService
  const mockAnalyticsService = {
    getLeadStats: jest.fn(),
    getDealStats: jest.fn(),
    getTaskStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLeadAnalytics', () => {
    it('should call analyticsService.getLeadStats and return its result', async () => {
      const memberId = 'test_member_id';
      const mockLeadStats = {
        leadByStatus: { NEW: 5, CONVERTED: 2 },
        totalLeads: 7,
        convertedLeads: 2,
        conversionRate: 0.28,
      };
      mockAnalyticsService.getLeadStats.mockResolvedValue(mockLeadStats);

      const result = await controller.getLeadAnalytics(memberId);

      expect(analyticsService.getLeadStats).toHaveBeenCalledWith(memberId);
      expect(result).toEqual(mockLeadStats);
    });

    it('should propagate errors from analyticsService.getLeadStats', async () => {
      const memberId = 'test_member_id';
      const errorMessage = 'Failed to fetch lead stats';
      mockAnalyticsService.getLeadStats.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(controller.getLeadAnalytics(memberId)).rejects.toThrow(
        errorMessage,
      );
      expect(analyticsService.getLeadStats).toHaveBeenCalledWith(memberId);
    });
  });

  describe('getDealAnalytics', () => {
    it('should call analyticsService.getDealStats and return its result', async () => {
      const memberId = 'test_member_id';
      const mockDealStats = {
        totalRevenue: 15000,
        revenueByDate: { '2025-07-10': 5000, '2025-07-11': 10000 },
      };
      mockAnalyticsService.getDealStats.mockResolvedValue(mockDealStats);

      const result = await controller.getDealAnalytics(memberId);

      expect(analyticsService.getDealStats).toHaveBeenCalledWith(memberId);
      expect(result).toEqual(mockDealStats);
    });

    it('should propagate errors from analyticsService.getDealStats', async () => {
      const memberId = 'test_member_id';
      const errorMessage = 'Failed to fetch deal stats';
      mockAnalyticsService.getDealStats.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(controller.getDealAnalytics(memberId)).rejects.toThrow(
        errorMessage,
      );
      expect(analyticsService.getDealStats).toHaveBeenCalledWith(memberId);
    });
  });

  describe('getTaskAnalytics', () => {
    it('should call analyticsService.getTaskStats and return its result', async () => {
      const memberId = 'test_member_id';
      const mockTaskStats = {
        completedTasks: 10,
        taskCountByUser: { user1: 7, user2: 3 },
      };
      mockAnalyticsService.getTaskStats.mockResolvedValue(mockTaskStats);

      const result = await controller.getTaskAnalytics(memberId);

      expect(analyticsService.getTaskStats).toHaveBeenCalledWith(memberId);
      expect(result).toEqual(mockTaskStats);
    });

    it('should propagate errors from analyticsService.getTaskStats', async () => {
      const memberId = 'test_member_id';
      const errorMessage = 'Failed to fetch task stats';
      mockAnalyticsService.getTaskStats.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(controller.getTaskAnalytics(memberId)).rejects.toThrow(
        errorMessage,
      );
      expect(analyticsService.getTaskStats).toHaveBeenCalledWith(memberId);
    });
  });
});
