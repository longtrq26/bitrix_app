import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDomainDto } from './dto/auth-domain.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<any>;
  let mockResponse: jest.Mocked<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockAuthService = {
      generateAuthUrl: jest.fn(),
      validateState: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getDomain: jest.fn(),
      getMemberIdFromSession: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);
    logger = module.get(WINSTON_MODULE_PROVIDER);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('redirectToBitrix', () => {
    it('should redirect to Bitrix24 OAuth URL', async () => {
      const domain = 'test.bitrix24.vn';
      const query: AuthDomainDto = { domain };
      const authUrl =
        'https://test.bitrix24.vn/oauth/authorize?client_id=123&state=abc';

      authService.generateAuthUrl.mockResolvedValue({
        url: authUrl,
        state: 'abc',
      });

      await controller.redirectToBitrix(query, mockResponse);

      expect(authService.generateAuthUrl).toHaveBeenCalledWith(domain);
      expect(mockResponse.redirect).toHaveBeenCalledWith(authUrl);
    });

    it('should throw HttpException when generateAuthUrl fails', async () => {
      const domain = 'test.bitrix24.vn';
      const query: AuthDomainDto = { domain };

      authService.generateAuthUrl.mockRejectedValue(
        new Error('Generation failed'),
      );

      await expect(
        controller.redirectToBitrix(query, mockResponse),
      ).rejects.toThrow(
        new HttpException(
          'Failed to generate redirect URL',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Redirect failed',
        expect.any(Error),
      );
    });
  });

  describe('handleCallback', () => {
    it('should handle successful callback and redirect with session token', async () => {
      const code = 'auth-code';
      const domain = 'test.bitrix24.vn';
      const state = 'valid-state';
      const query: AuthDomainDto = { domain };
      const sessionToken = 'session-token-123';
      const clientRedirectUrl = 'http://localhost:3000';

      authService.validateState.mockResolvedValue(true);
      authService.exchangeCodeForToken.mockResolvedValue({
        memberId: 'member-123',
        sessionToken,
      });
      configService.get.mockReturnValue(clientRedirectUrl);

      await controller.handleCallback(code, query, state, mockResponse);

      expect(authService.validateState).toHaveBeenCalledWith(domain, state);
      expect(authService.exchangeCodeForToken).toHaveBeenCalledWith(
        code,
        domain,
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${clientRedirectUrl}/auth/callback?session=${sessionToken}`,
      );
    });

    it('should throw BadRequestException for invalid domain', async () => {
      const code = 'auth-code';
      const domain = 'invalid-domain.com';
      const state = 'valid-state';
      const query: AuthDomainDto = { domain };

      await expect(
        controller.handleCallback(code, query, state, mockResponse),
      ).rejects.toThrow(new BadRequestException('Invalid domain'));

      expect(authService.validateState).not.toHaveBeenCalled();
      expect(authService.exchangeCodeForToken).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid state', async () => {
      const code = 'auth-code';
      const domain = 'test.bitrix24.vn';
      const state = 'invalid-state';
      const query: AuthDomainDto = { domain };

      authService.validateState.mockResolvedValue(false);

      await expect(
        controller.handleCallback(code, query, state, mockResponse),
      ).rejects.toThrow(new BadRequestException('Invalid state token'));

      expect(authService.validateState).toHaveBeenCalledWith(domain, state);
      expect(authService.exchangeCodeForToken).not.toHaveBeenCalled();
    });
  });

  describe('getDomain', () => {
    it('should return domain successfully', async () => {
      const memberId = 'member-123';
      const domain = 'test.bitrix24.vn';

      authService.getDomain.mockResolvedValue(domain);

      await controller.getDomain(memberId, mockResponse);

      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(domain);
    });

    it('should return 404 when domain not found', async () => {
      const memberId = 'member-123';

      authService.getDomain.mockRejectedValue(new Error('Domain not found'));

      await controller.getDomain(memberId, mockResponse);

      expect(authService.getDomain).toHaveBeenCalledWith(memberId);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith('Domain not found');
    });
  });

  describe('getMemberId', () => {
    it('should return member ID successfully', async () => {
      const sessionToken = 'session-token-123';
      const memberId = 'member-123';

      authService.getMemberIdFromSession.mockResolvedValue(memberId);

      await controller.getMemberId(sessionToken, mockResponse);

      expect(authService.getMemberIdFromSession).toHaveBeenCalledWith(
        sessionToken,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ memberId });
    });

    it('should return 401 when session is invalid', async () => {
      const sessionToken = 'invalid-session-token';

      authService.getMemberIdFromSession.mockRejectedValue(
        new Error('Invalid session'),
      );

      await controller.getMemberId(sessionToken, mockResponse);

      expect(authService.getMemberIdFromSession).toHaveBeenCalledWith(
        sessionToken,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid session');
    });
  });
});
