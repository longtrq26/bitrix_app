import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { AuthSessionService } from './services/auth-session.service';
import { AuthTokenService } from './services/auth-token.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let sessionService: jest.Mocked<AuthSessionService>;
  let tokenService: jest.Mocked<AuthTokenService>;
  let configService: jest.Mocked<ConfigService>;
  let res: jest.Mocked<Response>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateAuthUrl: jest.fn(),
            validateState: jest.fn(),
            exchangeCodeForToken: jest.fn(),
            getDomain: jest.fn(),
            getMemberIdFromSession: jest.fn(),
            ensureValidAccessToken: jest.fn(),
          },
        },
        { provide: AuthSessionService, useValue: { delete: jest.fn() } },
        { provide: AuthTokenService, useValue: { delete: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
    sessionService = module.get(AuthSessionService);
    tokenService = module.get(AuthTokenService);
    configService = module.get(ConfigService);

    res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as any;
  });

  describe('redirectToBitrix', () => {
    it('should redirect to Bitrix auth URL', async () => {
      authService.generateAuthUrl.mockResolvedValue({
        url: 'https://bitrix.url',
        state: 'mocked-state',
      });

      await controller.redirectToBitrix({ domain: 'example.bitrix24.vn' }, res);
      expect(res.redirect).toHaveBeenCalledWith('https://bitrix.url');
    });
  });

  describe('handleCallback', () => {
    it('should throw if domain is invalid', async () => {
      await expect(
        controller.handleCallback(
          'code',
          { domain: 'invalid.com' },
          'state',
          res,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should redirect to client after successful callback', async () => {
      authService.validateState.mockResolvedValue(true);
      authService.exchangeCodeForToken.mockResolvedValue({
        sessionToken: 'abc123',
        memberId: 'mem01',
      });
      configService.get.mockReturnValue('http://client');

      await controller.handleCallback(
        'code',
        { domain: 'abc.bitrix24.vn' },
        'state',
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'session_token',
        'abc123',
        expect.any(Object),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://client/auth/callback?session=abc123',
      );
    });
  });

  describe('getDomain', () => {
    it('should return domain', async () => {
      authService.getDomain.mockResolvedValue('abc.bitrix24.vn');
      await controller.getDomain('mem01', res);
      expect(res.send).toHaveBeenCalledWith('abc.bitrix24.vn');
    });

    it('should throw unauthorized if domain not found', async () => {
      authService.getDomain.mockRejectedValue(new UnauthorizedException());
      await expect(controller.getDomain('invalid', res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMemberId', () => {
    it('should return memberId', async () => {
      authService.getMemberIdFromSession.mockResolvedValue('mem01');
      await controller.getMemberId('session123', res);
      expect(res.json).toHaveBeenCalledWith({ memberId: 'mem01' });
    });

    it('should throw if session is invalid', async () => {
      authService.getMemberIdFromSession.mockRejectedValue(
        new UnauthorizedException(),
      );
      await expect(controller.getMemberId('bad', res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getAccessToken', () => {
    it('should return access token', async () => {
      authService.ensureValidAccessToken.mockResolvedValue('access-token');
      await controller.getAccessToken('mem01', res);
      expect(res.json).toHaveBeenCalledWith({ access_token: 'access-token' });
    });

    it('should throw if token cannot be refreshed', async () => {
      authService.ensureValidAccessToken.mockResolvedValue(null);
      await expect(controller.getAccessToken('mem01', res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete session and token and clear cookie', async () => {
      const req = { cookies: { session_token: 'abc123' } } as any;

      await controller.logout('mem01', req, res);

      expect(sessionService.delete).toHaveBeenCalledWith('abc123');
      expect(tokenService.delete).toHaveBeenCalledWith('mem01');
      expect(res.clearCookie).toHaveBeenCalledWith('session_token');
    });
  });
});
