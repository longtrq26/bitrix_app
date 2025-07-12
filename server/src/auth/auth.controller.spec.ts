import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    generateAuthUrl: jest.fn(),
    exchangeCodeForToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('redirectToBitrix', () => {
    it('should redirect to the generated Bitrix24 authorization URL', () => {
      const mockDomain = 'test.bitrix24.com';
      const mockAuthUrl = `https://${mockDomain}/oauth/authorize?client_id=mockClientId&state=123`;

      mockAuthService.generateAuthUrl.mockReturnValue(mockAuthUrl);

      const mockResponse: Partial<Response> = {
        redirect: jest.fn(),
      };

      controller.redirectToBitrix(mockDomain, mockResponse as Response);

      expect(authService.generateAuthUrl).toHaveBeenCalledWith(mockDomain);

      expect(mockResponse.redirect).toHaveBeenCalledWith(mockAuthUrl);
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'mockCode123';
    const mockDomain = 'test.bitrix24.com';
    const mockTokenResponse = {
      access_token: 'abc',
      refresh_token: 'xyz',
      expires_in: 3600,
      member_id: '123',
    };

    const mockResponse: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    it('should exchange code for token and return the token response', async () => {
      mockAuthService.exchangeCodeForToken.mockResolvedValue(mockTokenResponse);

      await controller.handleCallback(
        mockCode,
        mockDomain,
        mockResponse as Response,
      );

      expect(authService.exchangeCodeForToken).toHaveBeenCalledWith(
        mockCode,
        mockDomain,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockTokenResponse);
    });

    it('should throw an HttpException if exchangeCodeForToken fails', async () => {
      const errorMessage = 'Something went wrong during token exchange';

      mockAuthService.exchangeCodeForToken.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(
        controller.handleCallback(
          mockCode,
          mockDomain,
          mockResponse as Response,
        ),
      ).rejects.toThrow(
        new HttpException('OAuth callback failed', HttpStatus.BAD_REQUEST),
      );

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
