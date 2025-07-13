import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;
  let logger: any;

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.redirect = jest.fn();
    res.status = jest.fn().mockReturnThis();
    res.send = jest.fn();
    return res as Response;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateAuthUrl: jest.fn(),
            storeState: jest.fn(),
            getStoredState: jest.fn(),
            exchangeCodeForToken: jest.fn(),
            getDomain: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get(WINSTON_MODULE_PROVIDER);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('redirectToBitrix', () => {
    const validDomain = 'test.bitrix24.vn';
    const invalidDomain = 'invalid.com';
    const authUrl = 'https://bitrix.oauth/authorize?state=mockState';
    const state = 'mockState';

    it('should redirect to Bitrix24 OAuth URL for a valid domain', async () => {
      (authService.generateAuthUrl as jest.Mock).mockResolvedValue({
        url: authUrl,
        state,
      });
      const res = mockResponse();

      await controller.redirectToBitrix(validDomain, res);

      expect(authService.generateAuthUrl).toHaveBeenCalledWith(validDomain);
      expect(authService.storeState).toHaveBeenCalledWith(validDomain, state);
      expect(logger.info).toHaveBeenCalledWith(
        `Redirecting to Bitrix24 OAuth for domain: ${validDomain}`,
      );
      expect(res.redirect).toHaveBeenCalledWith(authUrl);
    });

    it('should throw HttpException for an invalid domain (missing)', async () => {
      const res = mockResponse();

      await expect(controller.redirectToBitrix('', res)).rejects.toThrow(
        new HttpException('Invalid domain', HttpStatus.BAD_REQUEST),
      );
      expect(authService.generateAuthUrl).not.toHaveBeenCalled();
      expect(authService.storeState).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should throw HttpException for an invalid domain (wrong suffix)', async () => {
      const res = mockResponse();

      await expect(
        controller.redirectToBitrix(invalidDomain, res),
      ).rejects.toThrow(
        new HttpException('Invalid domain', HttpStatus.BAD_REQUEST),
      );
      expect(authService.generateAuthUrl).not.toHaveBeenCalled();
      expect(authService.storeState).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    const validDomain = 'test.bitrix24.vn';
    const code = 'mockCode';
    const state = 'mockState';
    const memberId = 'mockMemberId123';
    const clientRedirectUrl = 'http://localhost:3000';
    const tokenResponse = {
      member_id: memberId,
      access_token: 'abc',
      refresh_token: 'xyz',
      expires_in: 3600,
    };

    beforeEach(() => {
      (configService.get as jest.Mock).mockReturnValue(clientRedirectUrl);
    });

    it('should handle callback, exchange code, and redirect to frontend', async () => {
      (authService.getStoredState as jest.Mock).mockResolvedValue(state);
      (authService.exchangeCodeForToken as jest.Mock).mockResolvedValue(
        tokenResponse,
      );
      const res = mockResponse();

      await controller.handleCallback(code, validDomain, state, res);

      expect(authService.getStoredState).toHaveBeenCalledWith(validDomain);
      expect(authService.exchangeCodeForToken).toHaveBeenCalledWith(
        code,
        validDomain,
      );
      expect(configService.get).toHaveBeenCalledWith('CLIENT_REDIRECT_URL');
      expect(logger.info).toHaveBeenCalledWith(
        `Redirecting to frontend: ${clientRedirectUrl} for member_id: ${memberId}`,
      );
      expect(res.redirect).toHaveBeenCalledWith(
        `${clientRedirectUrl}/auth/callback?member_id=${memberId}`,
      );
    });

    it('should throw HttpException for an invalid domain', async () => {
      const res = mockResponse();

      await expect(
        controller.handleCallback(code, 'wrong.com', state, res),
      ).rejects.toThrow(
        new HttpException('Invalid domain', HttpStatus.BAD_REQUEST),
      );
      expect(authService.getStoredState).not.toHaveBeenCalled();
      expect(authService.exchangeCodeForToken).not.toHaveBeenCalled();
      expect(configService.get).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should throw HttpException if state is missing in Redis', async () => {
      (authService.getStoredState as jest.Mock).mockResolvedValue(null);
      const res = mockResponse();

      await expect(
        controller.handleCallback(code, validDomain, state, res),
      ).rejects.toThrow(
        new HttpException('Invalid state', HttpStatus.BAD_REQUEST),
      );
      expect(authService.getStoredState).toHaveBeenCalledWith(validDomain);
      expect(authService.exchangeCodeForToken).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        `Invalid state for domain: ${validDomain}`,
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should throw HttpException if state does not match', async () => {
      (authService.getStoredState as jest.Mock).mockResolvedValue(
        'mismatchedState',
      );
      const res = mockResponse();

      await expect(
        controller.handleCallback(code, validDomain, state, res),
      ).rejects.toThrow(
        new HttpException('Invalid state', HttpStatus.BAD_REQUEST),
      );
      expect(authService.getStoredState).toHaveBeenCalledWith(validDomain);
      expect(authService.exchangeCodeForToken).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        `Invalid state for domain: ${validDomain}`,
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should throw HttpException if exchangeCodeForToken fails', async () => {
      (authService.getStoredState as jest.Mock).mockResolvedValue(state);
      const authServiceError = new UnauthorizedException('API error');
      (authService.exchangeCodeForToken as jest.Mock).mockRejectedValue(
        authServiceError,
      );
      const res = mockResponse();

      await expect(
        controller.handleCallback(code, validDomain, state, res),
      ).rejects.toThrow(
        new HttpException(
          `OAuth callback failed: ${authServiceError.message}`,
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(authService.exchangeCodeForToken).toHaveBeenCalledWith(
        code,
        validDomain,
      );
      expect(logger.error).toHaveBeenCalledWith(
        `OAuth callback failed for domain: ${validDomain}`,
        authServiceError,
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('getDomain', () => {
    const memberId = 'mockMemberId';
    const domain = 'expected.bitrix24.vn';

    it('should return the domain for a valid memberId', async () => {
      (authService.getDomain as jest.Mock).mockResolvedValue(domain);
      const res = mockResponse();

      await controller.getDomain(memberId, res);

      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(logger.info).toHaveBeenCalledWith(
        `Retrieved domain for member_id: ${memberId}`,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(domain);
    });

    it('should return 404 if authService.getDomain throws an error', async () => {
      const authServiceError = new UnauthorizedException(
        'No token data in Redis',
      );
      (authService.getDomain as jest.Mock).mockRejectedValue(authServiceError);
      const res = mockResponse();

      await controller.getDomain(memberId, res);

      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to get domain for member_id: ${memberId}`,
        authServiceError,
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Not Found');
    });
  });
});
