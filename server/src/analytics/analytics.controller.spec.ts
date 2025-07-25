import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: jest.Mocked<AnalyticsService>;

  const mockAuthService = {
    ensureValidAccessToken: jest.fn(),
    getMemberIdFromSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: {
            getLeadAnalytics: jest.fn(),
            getDealAnalytics: jest.fn(),
            getTaskAnalytics: jest.fn(),
          },
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

    controller = module.get(AnalyticsController);
    analyticsService = module.get(AnalyticsService);
  });

  describe('getLeadAnalytics', () => {
    it('should return lead analytics', async () => {
      analyticsService.getLeadAnalytics.mockResolvedValue({ total: 10 });
      const result = await controller.getLeadAnalytics(
        undefined as any,
        'mem01',
      );
      expect(result).toEqual({ total: 10 });
    });

    it('should throw if memberId is missing', async () => {
      await expect(
        controller.getLeadAnalytics(undefined as any, undefined as any),
      ).rejects.toThrow(HttpException);
    });

    it('should throw if queryMemberId mismatch', async () => {
      await expect(
        controller.getLeadAnalytics('mem-wrong', 'mem-real'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getDealAnalytics', () => {
    it('should return deal analytics', async () => {
      analyticsService.getDealAnalytics.mockResolvedValue({ closed: 5 });
      const result = await controller.getDealAnalytics(
        undefined as any,
        'mem02',
      );
      expect(result).toEqual({ closed: 5 });
    });

    it('should throw if memberId is missing', async () => {
      await expect(
        controller.getDealAnalytics(undefined as any, undefined as any),
      ).rejects.toThrow(HttpException);
    });

    it('should throw if queryMemberId mismatch', async () => {
      await expect(
        controller.getDealAnalytics('mem-bad', 'mem-ok'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getTaskAnalytics', () => {
    it('should return task analytics', async () => {
      analyticsService.getTaskAnalytics.mockResolvedValue({ completed: 7 });
      const result = await controller.getTaskAnalytics(
        undefined as any,
        'mem03',
      );
      expect(result).toEqual({ completed: 7 });
    });

    it('should throw if memberId is missing', async () => {
      await expect(
        controller.getTaskAnalytics(undefined as any, undefined as any),
      ).rejects.toThrow(HttpException);
    });

    it('should throw if queryMemberId mismatch', async () => {
      await expect(controller.getTaskAnalytics('memX', 'memY')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
