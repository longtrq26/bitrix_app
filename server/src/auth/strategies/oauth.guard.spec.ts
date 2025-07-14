import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { OAuthGuard } from './oauth.guard';

describe('OAuthGuard', () => {
  let guard: OAuthGuard;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockAuthService = {
      ensureValidAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthGuard,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    guard = module.get<OAuthGuard>(OAuthGuard);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  const createMockExecutionContext = (headers: any = {}): ExecutionContext => {
    const mockRequest = {
      headers,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should return true and set bitrixAccessToken when valid member ID and token', async () => {
      const memberId = 'member-123';
      const accessToken = 'valid-access-token';
      const context = createMockExecutionContext({ 'x-member-id': memberId });

      authService.ensureValidAccessToken.mockResolvedValue(accessToken);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(authService.ensureValidAccessToken).toHaveBeenCalledWith(memberId);

      const request = context.switchToHttp().getRequest();
      expect(request.bitrixAccessToken).toBe(accessToken);
    });

    it('should throw HttpException when member ID is missing', async () => {
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException('Missing member id', HttpStatus.UNAUTHORIZED),
      );

      expect(authService.ensureValidAccessToken).not.toHaveBeenCalled();
    });

    it('should throw HttpException when member ID is not a string', async () => {
      const context = createMockExecutionContext({ 'x-member-id': 123 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException('Missing member id', HttpStatus.UNAUTHORIZED),
      );

      expect(authService.ensureValidAccessToken).not.toHaveBeenCalled();
    });

    it('should throw HttpException when member ID is an array', async () => {
      const context = createMockExecutionContext({
        'x-member-id': ['member-123', 'member-456'],
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException('Missing member id', HttpStatus.UNAUTHORIZED),
      );

      expect(authService.ensureValidAccessToken).not.toHaveBeenCalled();
    });

    it('should throw HttpException when access token is null', async () => {
      const memberId = 'member-123';
      const context = createMockExecutionContext({ 'x-member-id': memberId });

      authService.ensureValidAccessToken.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED),
      );

      expect(authService.ensureValidAccessToken).toHaveBeenCalledWith(memberId);
    });

    it('should throw HttpException when access token is empty string', async () => {
      const memberId = 'member-123';
      const context = createMockExecutionContext({ 'x-member-id': memberId });

      authService.ensureValidAccessToken.mockResolvedValue('');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED),
      );

      expect(authService.ensureValidAccessToken).toHaveBeenCalledWith(memberId);
    });

    it('should handle authService errors', async () => {
      const memberId = 'member-123';
      const context = createMockExecutionContext({ 'x-member-id': memberId });

      authService.ensureValidAccessToken.mockRejectedValue(
        new Error('Token service error'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Token service error',
      );

      expect(authService.ensureValidAccessToken).toHaveBeenCalledWith(memberId);
    });
  });
});
