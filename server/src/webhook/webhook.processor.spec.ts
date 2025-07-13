import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
// Removed: import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

// Import processor cần test
import { WebhookProcessor } from './webhook.processor';
// Import các dependency để mock
import { AuthService } from '../auth/auth.service'; // Điều chỉnh đường dẫn nếu cần

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let httpService: HttpService;
  let authService: AuthService;
  // Removed: let logger: Logger;

  // Mock implementations cho các dependency
  const mockHttpService = {
    post: jest.fn(),
  };

  const mockAuthService = {
    getAccessToken: jest.fn(),
    getDomain: jest.fn(),
  };

  // Removed: Mock Logger constant
  // const mockLogger = {
  //   log: jest.fn(),
  //   error: jest.fn(),
  //   warn: jest.fn(),
  //   debug: jest.fn(),
  // };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessor,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        // Removed: Logger provider
        // {
        //   provide: Logger,
        //   useValue: mockLogger,
        // },
      ],
    }).compile();

    processor = module.get<WebhookProcessor>(WebhookProcessor);
    httpService = module.get<HttpService>(HttpService);
    authService = module.get<AuthService>(AuthService);
    // Removed: Logger instance retrieval
    // logger = module.get<Logger>(Logger);

    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  // --- Tests cho getRoundRobinUser ---
  describe('getRoundRobinUser', () => {
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const mockUsers = [
      { ID: 1, NAME: 'User A' },
      { ID: 2, NAME: 'User B' },
      { ID: 3, NAME: 'User C' },
    ];

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
    });

    it('should return a user ID from the list', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of({ data: { result: mockUsers } } as AxiosResponse),
      );

      const userId = await processor.getRoundRobinUser(memberId);

      expect(mockAuthService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(mockAuthService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/user.get`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      // Check if the returned ID is one of the mock user IDs
      expect(mockUsers.map((u) => u.ID)).toContain(userId);
    });

    it('should handle API call failure when fetching users', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('API Error fetching users')),
      );

      await expect(processor.getRoundRobinUser(memberId)).rejects.toThrow(
        'API Error fetching users',
      );
      expect(mockAuthService.getAccessToken).toHaveBeenCalled();
      expect(mockAuthService.getDomain).toHaveBeenCalled();
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should handle case where access token is null/undefined for user.get', async () => {
      mockAuthService.getAccessToken.mockResolvedValue(null);
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Invalid token for user.get')),
      );

      await expect(processor.getRoundRobinUser(memberId)).rejects.toThrow(
        'Invalid token for user.get',
      );
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/user.get`,
        {},
        { headers: { Authorization: `Bearer ${null}` } }, // Should be 'Bearer null'
      );
    });
  });

  // --- Tests cho handleCreateTask ---
  describe('handleCreateTask', () => {
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const leadData = {
      ID: '123',
      TITLE: 'New Lead',
      PHONE: '123-456-7890',
      EMAIL: 'test@example.com',
      SOURCE_ID: 'WEB',
    };
    const mockJob: Job = {
      data: { lead: leadData, memberId },
    } as Job; // Cast to Job for simplicity in test

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
      // Spy on getRoundRobinUser and mock its return value
      jest.spyOn(processor, 'getRoundRobinUser').mockResolvedValue(1); // Mock a fixed user ID
    });

    it('should create a task for the lead', async () => {
      const mockResponseData = { result: { ID: 'task456' } };
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockResponseData } as AxiosResponse),
      );

      const result = await processor.handleCreateTask(mockJob);

      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(processor.getRoundRobinUser).toHaveBeenCalledWith(memberId); // Ensure internal method is called

      const expectedTaskPayload = {
        TITLE: `Follow up Lead: ${leadData.TITLE}`,
        DESCRIPTION: `Contact Info:\nPhone: ${leadData.PHONE}\nEmail: ${leadData.EMAIL}\nSource: ${leadData.SOURCE_ID}`,
        RESPONSIBLE_ID: 1, // From mocked getRoundRobinUser
        UF_CRM_TASK: [`L_${leadData.ID}`],
      };

      expect(httpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/tasks.task.add`,
        { fields: expectedTaskPayload },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      // Removed: expect(logger.log).toHaveBeenCalledWith(...)
      expect(result).toEqual(mockResponseData);
    });

    it('should handle API call failure during task creation', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Task creation failed')),
      );

      await expect(processor.handleCreateTask(mockJob)).rejects.toThrow(
        'Task creation failed',
      );
      // Removed: expect(logger.log).not.toHaveBeenCalled();
    });
  });

  // --- Tests cho handleCreateDeal ---
  describe('handleCreateDeal', () => {
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const leadData = {
      ID: '123',
      TITLE: 'Converted Lead',
      OPPORTUNITY: 5000,
    };
    const mockJob: Job = {
      data: { lead: leadData, memberId },
    } as Job;

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
    });

    it('should create a deal for the lead', async () => {
      const mockResponseData = { result: { ID: 'deal789' } };
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockResponseData } as AxiosResponse),
      );

      const result = await processor.handleCreateDeal(mockJob);

      expect(authService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(authService.getDomain).toHaveBeenCalledWith(memberId);

      const expectedDealPayload = {
        TITLE: `Deal for ${leadData.TITLE}`,
        LEAD_ID: leadData.ID,
        OPPORTUNITY: leadData.OPPORTUNITY,
      };

      expect(httpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/crm.deal.add`,
        { fields: expectedDealPayload },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      // Removed: expect(logger.log).toHaveBeenCalledWith(...)
      expect(result).toEqual(mockResponseData);
    });

    it('should use default opportunity if not provided in lead data', async () => {
      const leadDataWithoutOpportunity = {
        ID: '125',
        TITLE: 'Lead without Opportunity',
      };
      const mockJobWithoutOpportunity: Job = {
        data: { lead: leadDataWithoutOpportunity, memberId },
      } as Job;

      const mockResponseData = { result: { ID: 'deal999' } };
      mockHttpService.post.mockReturnValueOnce(
        of({ data: mockResponseData } as AxiosResponse),
      );

      const result = await processor.handleCreateDeal(
        mockJobWithoutOpportunity,
      );

      const expectedDealPayload = {
        TITLE: `Deal for ${leadDataWithoutOpportunity.TITLE}`,
        LEAD_ID: leadDataWithoutOpportunity.ID,
        OPPORTUNITY: 1000, // Default value
      };

      expect(httpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/crm.deal.add`,
        { fields: expectedDealPayload },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(result).toEqual(mockResponseData);
    });

    it('should handle API call failure during deal creation', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Deal creation failed')),
      );

      await expect(processor.handleCreateDeal(mockJob)).rejects.toThrow(
        'Deal creation failed',
      );
      // Removed: expect(logger.log).not.toHaveBeenCalled();
    });
  });
});
