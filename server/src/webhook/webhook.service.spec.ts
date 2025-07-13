import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bull';
import { of, throwError } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';
import { WebhookService } from './webhook.service';

class MockWebhookDto {
  event: string;
  data: {
    FIELDS: Record<string, any>;
  };
  auth: string;
  memberId: string;
}

describe('WebhookService', () => {
  let service: WebhookService;
  let webhookQueue: Queue;
  let authService: AuthService;
  let httpService: HttpService;

  const mockWebhookQueue = {
    add: jest.fn(),
  };

  const mockAuthService = {
    getAccessToken: jest.fn(),
    getDomain: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    delete process.env.WEBHOOK_SECRET;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getQueueToken('webhook'),
          useValue: mockWebhookQueue,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    webhookQueue = module.get<Queue>(getQueueToken('webhook'));
    authService = module.get<AuthService>(AuthService);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateToken', () => {
    const secretToken = 'my_secret_webhook_token';

    beforeEach(() => {
      process.env.WEBHOOK_SECRET = secretToken;
    });

    afterEach(() => {
      delete process.env.WEBHOOK_SECRET;
    });

    it('should return true for a valid token', () => {
      const isValid = service.validateToken(secretToken);
      expect(isValid).toBe(true);
    });

    it('should return false for an invalid token', () => {
      const isValid = service.validateToken('invalid_token');
      expect(isValid).toBe(false);
    });

    it('should return false if WEBHOOK_SECRET is not set', () => {
      delete process.env.WEBHOOK_SECRET;
      const isValid = service.validateToken(secretToken);
      expect(isValid).toBe(false);
    });
  });

  describe('handleLeadWebhook', () => {
    const validToken = 'valid_token';
    const invalidToken = 'invalid_token';
    const memberId = 'test_member_id';
    const leadData = { ID: '123', TITLE: 'Test Lead', STATUS_ID: 'NEW' };
    const convertedLeadData = {
      ID: '124',
      TITLE: 'Converted Lead',
      STATUS_ID: 'CONVERTED',
    };

    beforeEach(() => {
      process.env.WEBHOOK_SECRET = validToken;
      jest.spyOn(service, 'validateToken').mockReturnValue(true);
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      jest.spyOn(service, 'validateToken').mockReturnValue(false);
      const payload: MockWebhookDto = {
        event: 'ONCRMLEADADD',
        data: { FIELDS: leadData },
        auth: invalidToken,
        memberId,
      };

      await expect(
        service.handleLeadWebhook(payload, invalidToken),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.validateToken).toHaveBeenCalledWith(invalidToken);
      expect(mockWebhookQueue.add).not.toHaveBeenCalled();
    });

    it('should add "createTask" to queue for ONCRMLEADADD event', async () => {
      const payload: MockWebhookDto = {
        event: 'ONCRMLEADADD',
        data: { FIELDS: leadData },
        auth: invalidToken,
        memberId,
      };
      const result = await service.handleLeadWebhook(payload, validToken);

      expect(service.validateToken).toHaveBeenCalledWith(validToken);
      expect(mockWebhookQueue.add).toHaveBeenCalledWith('createTask', {
        lead: leadData,
        memberId,
      });
      expect(mockWebhookQueue.add).not.toHaveBeenCalledWith(
        'createDeal',
        expect.anything(),
      );
      expect(result).toEqual({ status: 'accepted' });
    });

    it('should add "createDeal" to queue for ONCRMLEADUPDATE event with CONVERTED status', async () => {
      const payload: MockWebhookDto = {
        event: 'ONCRMLEADUPDATE',
        data: { FIELDS: convertedLeadData },
        auth: invalidToken,
        memberId,
      };
      const result = await service.handleLeadWebhook(payload, validToken);

      expect(service.validateToken).toHaveBeenCalledWith(validToken);
      expect(mockWebhookQueue.add).toHaveBeenCalledWith('createDeal', {
        lead: convertedLeadData,
        memberId,
      });
      expect(mockWebhookQueue.add).not.toHaveBeenCalledWith(
        'createTask',
        expect.anything(),
      );
      expect(result).toEqual({ status: 'accepted' });
    });

    it('should do nothing for ONCRMLEADUPDATE event with non-CONVERTED status', async () => {
      const payload: MockWebhookDto = {
        event: 'ONCRMLEADUPDATE',
        data: { FIELDS: leadData },
        auth: invalidToken,
        memberId,
      };
      const result = await service.handleLeadWebhook(payload, validToken);

      expect(service.validateToken).toHaveBeenCalledWith(validToken);
      expect(mockWebhookQueue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'accepted' });
    });

    it('should do nothing for unknown events', async () => {
      const payload: MockWebhookDto = {
        event: 'UNKNOWN_EVENT',
        data: { FIELDS: leadData },
        auth: invalidToken,
        memberId,
      };
      const result = await service.handleLeadWebhook(payload, validToken);

      expect(service.validateToken).toHaveBeenCalledWith(validToken);
      expect(mockWebhookQueue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'accepted' });
    });
  });

  describe('getTasksForLead', () => {
    const leadId = '123';
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const mockTasks = [
      { id: 'task1', title: 'Task 1' },
      { id: 'task2', title: 'Task 2' },
    ];

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
    });

    it('should fetch tasks for a given leadId and memberId', async () => {
      mockHttpService.post.mockReturnValue(
        of({ data: { result: { tasks: mockTasks } } }),
      );

      const tasks = await service.getTasksForLead(leadId, memberId);

      expect(mockAuthService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(mockAuthService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/tasks.task.list`,
        { filter: { UF_CRM_TASK: [`L_${leadId}`] } },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(tasks).toEqual(mockTasks);
    });

    it('should handle API call failure', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('API Error fetching tasks')),
      );
      await expect(service.getTasksForLead(leadId, memberId)).rejects.toThrow(
        'API Error fetching tasks',
      );
      expect(mockAuthService.getAccessToken).toHaveBeenCalled();
      expect(mockAuthService.getDomain).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle case where access token is null/undefined', async () => {
      mockAuthService.getAccessToken.mockResolvedValue(null);
      mockAuthService.getDomain.mockResolvedValue(domain);

      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Invalid or missing access token')),
      );

      await expect(service.getTasksForLead(leadId, memberId)).rejects.toThrow(
        'Invalid or missing access token',
      );
      expect(mockAuthService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(mockAuthService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/tasks.task.list`,
        expect.any(Object),
        { headers: { Authorization: `Bearer ${null}` } },
      );
    });
  });

  describe('getDealsForLead', () => {
    const leadId = '123';
    const memberId = 'test_member_id';
    const accessToken = 'mock_access_token';
    const domain = 'mock.bitrix24.com';
    const mockDealsResult = {
      deals: [
        { id: 'deal1', title: 'Deal 1' },
        { id: 'deal2', title: 'Deal 2' },
      ],
    };

    beforeEach(() => {
      mockAuthService.getAccessToken.mockResolvedValue(accessToken);
      mockAuthService.getDomain.mockResolvedValue(domain);
    });

    it('should fetch deals for a given leadId and memberId', async () => {
      mockHttpService.post.mockReturnValue(
        of({ data: { result: mockDealsResult } }),
      );

      const deals = await service.getDealsForLead(leadId, memberId);

      expect(mockAuthService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(mockAuthService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/crm.deal.list`,
        { filter: { LEAD_ID: leadId } },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      expect(deals).toEqual(mockDealsResult);
    });

    it('should handle API call failure', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('API Error fetching deals')),
      );
      await expect(service.getDealsForLead(leadId, memberId)).rejects.toThrow(
        'API Error fetching deals',
      );
      expect(mockAuthService.getAccessToken).toHaveBeenCalled();
      expect(mockAuthService.getDomain).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle case where access token is null/undefined', async () => {
      mockAuthService.getAccessToken.mockResolvedValue(null);
      mockAuthService.getDomain.mockResolvedValue(domain);

      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Invalid or missing access token')),
      );

      await expect(service.getDealsForLead(leadId, memberId)).rejects.toThrow(
        'Invalid or missing access token',
      );
      expect(mockAuthService.getAccessToken).toHaveBeenCalledWith(memberId);
      expect(mockAuthService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        `https://${domain}/rest/crm.deal.list`,
        expect.any(Object),
        { headers: { Authorization: `Bearer ${null}` } },
      );
    });
  });
});
