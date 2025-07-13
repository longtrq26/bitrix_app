import { Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { HttpService } from '@nestjs/axios';
import { RedisService } from 'src/redis/redis.service';
import { AuthService } from 'src/auth/auth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpService: HttpService;
  let redisService: RedisService;
  let authService: AuthService;
  let logger: Logger;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockAuthService = {
    getAccessToken: jest.fn(),
    getDomain: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    httpService = module.get<HttpService>(HttpService);
    redisService = module.get<RedisService>(RedisService);
    authService = module.get<AuthService>(AuthService);
    logger = module.get<Logger>(Logger);

    jest.clearAllMocks(); // Clear mocks before each test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Tests for getLeadStats ---
  describe('getLeadStats', () => {
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const cacheKey = 'analytics:leads';

    const mockLeads = [
      { ID: '1', TITLE: 'Lead A', STATUS_ID: 'NEW', PHONE: '1', EMAIL: 'a@a' },
      {
        ID: '2',
        TITLE: 'Lead B',
        STATUS_ID: 'IN_PROGRESS',
        PHONE: '2',
        EMAIL: 'b@b',
      },
      { ID: '3', TITLE: 'Lead C', STATUS_ID: 'NEW', PHONE: '3', EMAIL: 'c@c' },
      {
        ID: '4',
        TITLE: 'Lead D',
        STATUS_ID: 'QUALIFIED',
        PHONE: '4',
        EMAIL: 'd@d',
      },
    ];
    const mockDeals = [
      { DEAL_ID: '101', LEAD_ID: '1', OPPORTUNITY: 100 },
      { DEAL_ID: '102', LEAD_ID: '3', OPPORTUNITY: 200 },
      { DEAL_ID: '103', LEAD_ID: null, OPPORTUNITY: 50 }, // Not converted from lead
    ];

    const expectedLeadStats = {
      leadByStatus: { NEW: 2, IN_PROGRESS: 1, QUALIFIED: 1 },
      totalLeads: 4,
      convertedLeads: 2,
      conversionRate: 0.5, // 2 converted / 4 total
    };

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
    });

    it('should return cached lead stats if available', async () => {
      mockRedisService.get.mockResolvedValueOnce(
        JSON.stringify(expectedLeadStats),
      );

      const result = await service.getLeadStats(memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(expectedLeadStats);
      expect(authService.getAccessToken).not.toHaveBeenCalled(); // Should not call API if cached
      expect(httpService.post).not.toHaveBeenCalled(); // Should not call API if cached
    });

    it('should fetch, process, and cache lead stats if not cached', async () => {
      mockRedisService.get.mockResolvedValueOnce(null); // Cache miss
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: {
            result: {
              result: {
                leads: mockLeads,
                deals: mockDeals,
              },
            },
          },
        } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getLeadStats(memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/batch`,
        { halt: 0, cmd: { leads: 'crm.lead.list', deals: 'crm.deal.list' } },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(expectedLeadStats),
        900,
      );
      expect(result).toEqual(expectedLeadStats);
    });

    it('should handle API call failure for lead stats', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('API Error fetching lead/deal data')),
      );

      await expect(service.getLeadStats(memberId)).rejects.toThrow(
        'API Error fetching lead/deal data',
      );
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled(); // Should not cache on failure
    });

    it('should handle empty leads array gracefully', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: {
            result: {
              result: {
                leads: [],
                deals: [],
              },
            },
          },
        } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getLeadStats(memberId);
      expect(result.totalLeads).toBe(0);
      expect(result.convertedLeads).toBe(0);
      expect(result.conversionRate).toBe(0); // Should handle 0/0 case properly
      expect(result.leadByStatus).toEqual({});
    });
  });

  // --- Tests for getDealStats ---
  describe('getDealStats', () => {
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const cacheKey = 'analytics:deals';

    const mockDeals = [
      { DEAL_ID: '1', OPPORTUNITY: 1000, DATE_CREATE: '2025-07-08T10:00:00Z' },
      { DEAL_ID: '2', OPPORTUNITY: 2000, DATE_CREATE: '2025-07-09T11:00:00Z' },
      { DEAL_ID: '3', OPPORTUNITY: 500, DATE_CREATE: '2025-07-09T12:00:00Z' },
      { DEAL_ID: '4', OPPORTUNITY: 1500, DATE_CREATE: '2025-07-10T13:00:00Z' },
      { DEAL_ID: '5', OPPORTUNITY: 0, DATE_CREATE: '2025-07-11T14:00:00Z' }, // Opportunity is 0
      { DEAL_ID: '6', OPPORTUNITY: null, DATE_CREATE: '2025-07-12T15:00:00Z' }, // Opportunity is null
      { DEAL_ID: '7', OPPORTUNITY: 3000, DATE_CREATE: '2025-06-01T16:00:00Z' }, // Outside 7-day window
    ];

    let mockDate: Date;
    let realDate: DateConstructor;

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);

      // Store real Date constructor
      realDate = Date;

      // Mock Date for consistent test results
      mockDate = new Date('2025-07-13T00:00:00Z'); // Today
      global.Date = jest
        .fn()
        .mockImplementation((dateString?: string | number | Date) => {
          if (dateString) {
            return new realDate(dateString);
          }
          return mockDate;
        }) as any;

      // Mock Date static methods
      global.Date.now = jest.fn(() => mockDate.getTime());
      global.Date.parse = realDate.parse;
      global.Date.UTC = realDate.UTC;
    });

    afterEach(() => {
      // Restore original Date
      global.Date = realDate;
    });

    it('should return cached deal stats if available', async () => {
      const expectedCachedStats = {
        totalRevenue: 10000,
        revenueByDate: { '2025-07-12': 5000 },
      };
      mockRedisService.get.mockResolvedValueOnce(
        JSON.stringify(expectedCachedStats),
      );

      const result = await service.getDealStats(memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(expectedCachedStats);
      expect(authService.getAccessToken).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch, process, and cache deal stats if not cached', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { result: mockDeals } } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getDealStats(memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/crm.deal.list`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      // Calculate expected revenueByDate based on mockDate and mockDeals
      const expectedRevenueByDate: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new realDate(mockDate);
        date.setDate(mockDate.getDate() - i);
        expectedRevenueByDate[date.toISOString().split('T')[0]] = 0;
      }
      expectedRevenueByDate['2025-07-08'] = 1000;
      expectedRevenueByDate['2025-07-09'] = 2500; // 2000 + 500
      expectedRevenueByDate['2025-07-10'] = 1500;
      expectedRevenueByDate['2025-07-11'] = 0;
      expectedRevenueByDate['2025-07-12'] = 0; // null opportunity
      expectedRevenueByDate['2025-07-13'] = 0; // Today, no deals

      const expectedTotalRevenue = 1000 + 2000 + 500 + 1500 + 0 + 0 + 3000; // Sum of all mock deals
      const expectedResult = {
        totalRevenue: expectedTotalRevenue,
        revenueByDate: expectedRevenueByDate,
      };

      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(expectedResult),
        900,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle API call failure for deal stats', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('API Error fetching deal data')),
      );

      await expect(service.getDealStats(memberId)).rejects.toThrow(
        'API Error fetching deal data',
      );
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should handle empty deals array gracefully', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { result: [] } } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getDealStats(memberId);
      expect(result.totalRevenue).toBe(0);
      const expectedEmptyRevenueByDate: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new realDate(mockDate);
        date.setDate(mockDate.getDate() - i);
        expectedEmptyRevenueByDate[date.toISOString().split('T')[0]] = 0;
      }
      expect(result.revenueByDate).toEqual(expectedEmptyRevenueByDate);
    });
  });

  // --- Tests for getTaskStats ---
  describe('getTaskStats', () => {
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const cacheKey = 'analytics:tasks';

    const mockTasks = [
      { ID: 't1', STATUS: '5', RESPONSIBLE_ID: '101' },
      { ID: 't2', STATUS: '5', RESPONSIBLE_ID: '102' },
      { ID: 't3', STATUS: '5', RESPONSIBLE_ID: '101' },
      { ID: 't4', STATUS: '2', RESPONSIBLE_ID: '103' }, // This should be filtered out since STATUS is not '5'
    ];

    // The service should filter tasks to only include those with STATUS '5'
    // So only t1, t2, t3 should be counted
    const expectedTaskStats = {
      completedTasks: 3, // Only t1, t2, t3 have STATUS '5'
      taskCountByUser: { '101': 2, '102': 1 }, // Only count users with completed tasks
    };

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
    });

    it('should return cached task stats if available', async () => {
      mockRedisService.get.mockResolvedValueOnce(
        JSON.stringify(expectedTaskStats),
      );

      const result = await service.getTaskStats(memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(expectedTaskStats);
      expect(authService.getAccessToken).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should fetch, process, and cache task stats if not cached', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      // Mock response should only include tasks with STATUS '5' since the API call uses filter
      const filteredTasks = mockTasks.filter((task) => task.STATUS === '5');
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { result: { tasks: filteredTasks } } } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getTaskStats(memberId);

      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(httpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/tasks.task.list`,
        { filter: { STATUS: '5' } },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(expectedTaskStats),
        900,
      );
      expect(result).toEqual(expectedTaskStats);
    });

    it('should handle API call failure for task stats', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('API Error fetching task data')),
      );

      await expect(service.getTaskStats(memberId)).rejects.toThrow(
        'API Error fetching task data',
      );
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(authService.getAccessToken).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should handle empty tasks array gracefully', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { result: { tasks: [] } } } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getTaskStats(memberId);
      expect(result.completedTasks).toBe(0);
      expect(result.taskCountByUser).toEqual({});
    });

    it('should handle tasks with missing RESPONSIBLE_ID', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      const tasksWithMissingIds = [
        { ID: 't1', STATUS: '5', RESPONSIBLE_ID: '101' },
        { ID: 't2', STATUS: '5', RESPONSIBLE_ID: '102' },
        { ID: 't3', STATUS: '5', RESPONSIBLE_ID: null },
        { ID: 't4', STATUS: '5', RESPONSIBLE_ID: undefined },
      ];
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: { result: { tasks: tasksWithMissingIds } },
        } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getTaskStats(memberId);

      expect(result.completedTasks).toBe(4);
      expect(result.taskCountByUser).toEqual({ '101': 1, '102': 1 });
    });

    it('should group tasks correctly by user', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      const tasksGroupedByUser = [
        { ID: 't1', STATUS: '5', RESPONSIBLE_ID: '101' },
        { ID: 't2', STATUS: '5', RESPONSIBLE_ID: '101' },
        { ID: 't3', STATUS: '5', RESPONSIBLE_ID: '101' },
        { ID: 't4', STATUS: '5', RESPONSIBLE_ID: '102' },
        { ID: 't5', STATUS: '5', RESPONSIBLE_ID: '102' },
        { ID: 't6', STATUS: '5', RESPONSIBLE_ID: '103' },
      ];
      mockHttpService.post.mockReturnValueOnce(
        of({
          data: { result: { tasks: tasksGroupedByUser } },
        } as AxiosResponse),
      );
      mockRedisService.set.mockResolvedValueOnce('OK');

      const result = await service.getTaskStats(memberId);

      expect(result.completedTasks).toBe(6);
      expect(result.taskCountByUser).toEqual({
        '101': 3,
        '102': 2,
        '103': 1,
      });
    });
  });
});
