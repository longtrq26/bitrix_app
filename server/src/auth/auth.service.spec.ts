import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthSessionService } from './services/auth-session.service';
import { AuthStateService } from './services/auth-state.service';
import { AuthTokenService } from './services/auth-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let tokenService: jest.Mocked<AuthTokenService>;
  let sessionService: jest.Mocked<AuthSessionService>;
  let stateService: jest.Mocked<AuthStateService>;
  let logger: jest.Mocked<any>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockHttpService = {
      post: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockTokenService = {
      saveToken: jest.fn(),
      getToken: jest.fn(),
      getAccessToken: jest.fn(),
      getDomain: jest.fn(),
    };

    const mockSessionService = {
      create: jest.fn(),
      getMemberId: jest.fn(),
    };

    const mockStateService = {
      save: jest.fn(),
      validate: jest.fn(),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthTokenService,
          useValue: mockTokenService,
        },
        {
          provide: AuthSessionService,
          useValue: mockSessionService,
        },
        {
          provide: AuthStateService,
          useValue: mockStateService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    tokenService = module.get(AuthTokenService);
    sessionService = module.get(AuthSessionService);
    stateService = module.get(AuthStateService);
    logger = module.get(WINSTON_MODULE_PROVIDER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAuthUrl', () => {
    it('should generate auth URL with state', async () => {
      const domain = 'test.bitrix24.vn';
      const clientId = 'test-client-id';

      configService.get.mockReturnValue(clientId);
      stateService.save.mockResolvedValue(undefined);

      const result = await service.generateAuthUrl(domain);

      expect(result.url).toContain(`https://${domain}/oauth/authorize`);
      expect(result.url).toContain(`client_id=${clientId}`);
      expect(result.url).toContain('state=');
      expect(result.state).toBeDefined();
      expect(stateService.save).toHaveBeenCalledWith(domain, result.state);
    });

    it('should throw error when client ID is missing', async () => {
      const domain = 'test.bitrix24.vn';

      configService.get.mockReturnValue(undefined);

      await expect(service.generateAuthUrl(domain)).rejects.toThrow(
        'Missing client ID',
      );
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token and create session', async () => {
      const code = 'test-code';
      const domain = 'test.bitrix24.vn';
      const clientId = 'test-client-id';
      const clientSecret = 'test-client-secret';
      const tokenResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        member_id: 'member-123',
      };
      const sessionToken = 'session-token';

      configService.get.mockImplementation((key) => {
        if (key === 'BITRIX24_CLIENT_ID') return clientId;
        if (key === 'BITRIX24_CLIENT_SECRET') return clientSecret;
      });

      httpService.post.mockReturnValue(
        of({
          data: tokenResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as any),
      );
      tokenService.saveToken.mockResolvedValue(undefined);
      sessionService.create.mockResolvedValue(sessionToken);

      const result = await service.exchangeCodeForToken(code, domain);

      expect(result.memberId).toBe('member-123');
      expect(result.sessionToken).toBe(sessionToken);
      expect(tokenService.saveToken).toHaveBeenCalledWith(
        'member-123',
        {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          domain,
        },
        3600,
      );
      expect(sessionService.create).toHaveBeenCalledWith('member-123');
    });

    it('should handle HTTP errors', async () => {
      const code = 'test-code';
      const domain = 'test.bitrix24.vn';

      configService.get.mockImplementation((key) => {
        if (key === 'BITRIX24_CLIENT_ID') return 'client-id';
        if (key === 'BITRIX24_CLIENT_SECRET') return 'client-secret';
      });

      httpService.post.mockReturnValue(
        throwError(() => new Error('HTTP Error')),
      );

      await expect(service.exchangeCodeForToken(code, domain)).rejects.toThrow(
        'HTTP Error',
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const memberId = 'member-123';
      const oldToken = {
        access_token: 'old-access-token',
        refresh_token: 'old-refresh-token',
        expires_in: 3600,
        domain: 'test.bitrix24.vn',
      };
      const newTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      configService.get.mockImplementation((key) => {
        if (key === 'BITRIX24_CLIENT_ID') return 'client-id';
        if (key === 'BITRIX24_CLIENT_SECRET') return 'client-secret';
      });

      tokenService.getToken.mockResolvedValue(oldToken);
      httpService.post.mockReturnValue(
        of({
          data: newTokenResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as any),
      );
      tokenService.saveToken.mockResolvedValue(undefined);

      const result = await service.refreshToken(memberId);

      expect(result).toBe('new-access-token');
      expect(tokenService.saveToken).toHaveBeenCalledWith(
        memberId,
        {
          ...oldToken,
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
        3600,
      );
    });

    it('should handle refresh token errors', async () => {
      const memberId = 'member-123';
      const oldToken = {
        access_token: 'old-access-token',
        refresh_token: 'old-refresh-token',
        expires_in: 3600,
        domain: 'test.bitrix24.vn',
      };

      configService.get.mockImplementation((key) => {
        if (key === 'BITRIX24_CLIENT_ID') return 'client-id';
        if (key === 'BITRIX24_CLIENT_SECRET') return 'client-secret';
      });

      tokenService.getToken.mockResolvedValue(oldToken);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Refresh failed')),
      );

      await expect(service.refreshToken(memberId)).rejects.toThrow(
        'Refresh failed',
      );
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from token service', async () => {
      const memberId = 'member-123';
      const accessToken = 'access-token';

      tokenService.getAccessToken.mockResolvedValue(accessToken);

      const result = await service.getAccessToken(memberId);

      expect(result).toBe(accessToken);
      expect(tokenService.getAccessToken).toHaveBeenCalledWith(memberId);
    });
  });

  describe('getDomain', () => {
    it('should return domain from token service', async () => {
      const memberId = 'member-123';
      const domain = 'test.bitrix24.vn';

      tokenService.getDomain.mockResolvedValue(domain);

      const result = await service.getDomain(memberId);

      expect(result).toBe(domain);
      expect(tokenService.getDomain).toHaveBeenCalledWith(memberId);
    });
  });

  describe('getMemberIdFromSession', () => {
    it('should return member ID from session service', async () => {
      const sessionToken = 'session-token';
      const memberId = 'member-123';

      sessionService.getMemberId.mockResolvedValue(memberId);

      const result = await service.getMemberIdFromSession(sessionToken);

      expect(result).toBe(memberId);
      expect(sessionService.getMemberId).toHaveBeenCalledWith(sessionToken);
    });
  });

  describe('validateState', () => {
    it('should validate state using state service', async () => {
      const domain = 'test.bitrix24.vn';
      const state = 'test-state';

      stateService.validate.mockResolvedValue(true);

      const result = await service.validateState(domain, state);

      expect(result).toBe(true);
      expect(stateService.validate).toHaveBeenCalledWith(domain, state);
    });
  });

  describe('ensureValidAccessToken', () => {
    it('should return existing valid access token', async () => {
      const memberId = 'member-123';
      const accessToken = 'valid-access-token';

      tokenService.getAccessToken.mockResolvedValue(accessToken);

      const result = await service.ensureValidAccessToken(memberId);

      expect(result).toBe(accessToken);
      expect(tokenService.getAccessToken).toHaveBeenCalledWith(memberId);
    });

    it('should refresh token when access token is null', async () => {
      const memberId = 'member-123';
      const fullToken = {
        access_token: null,
        refresh_token: 'refresh-token',
        expires_in: 3600,
        domain: 'test.bitrix24.vn',
      };
      const newAccessToken = 'new-access-token';

      tokenService.getAccessToken.mockResolvedValue(null);
      tokenService.getToken.mockResolvedValue(fullToken);
      jest.spyOn(service, 'refreshToken').mockResolvedValue(newAccessToken);

      const result = await service.ensureValidAccessToken(memberId);

      expect(result).toBe(newAccessToken);
      expect(service.refreshToken).toHaveBeenCalledWith(memberId);
    });

    it('should return null when no refresh token is available', async () => {
      const memberId = 'member-123';
      const fullToken = {
        access_token: null,
        refresh_token: null,
        expires_in: 3600,
        domain: 'test.bitrix24.vn',
      };

      tokenService.getAccessToken.mockResolvedValue(null);
      tokenService.getToken.mockResolvedValue(fullToken);

      const result = await service.ensureValidAccessToken(memberId);

      expect(result).toBeNull();
    });

    it('should return null when refresh token fails', async () => {
      const memberId = 'member-123';
      const fullToken = {
        access_token: null,
        refresh_token: 'refresh-token',
        expires_in: 3600,
        domain: 'test.bitrix24.vn',
      };

      tokenService.getAccessToken.mockResolvedValue(null);
      tokenService.getToken.mockResolvedValue(fullToken);
      jest
        .spyOn(service, 'refreshToken')
        .mockRejectedValue(new Error('Refresh failed'));

      const result = await service.ensureValidAccessToken(memberId);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        `Failed to refresh token for member_id ${memberId}: Refresh failed`,
      );
    });
  });
});
