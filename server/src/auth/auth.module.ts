import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CryptoModule } from 'src/common/crypto/crypto.module';
import { RedisModule } from 'src/redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionService } from './services/auth-session.service';
import { AuthStateService } from './services/auth-state.service';
import { AuthTokenService } from './services/auth-token.service';
import { OAuthGuard } from './strategies/oauth.guard';

@Module({
  imports: [HttpModule, CryptoModule, RedisModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    AuthSessionService,
    AuthStateService,
    OAuthGuard,
  ],
  exports: [
    AuthService,
    AuthTokenService,
    AuthSessionService,
    AuthStateService,
    OAuthGuard,
  ],
})
export class AuthModule {}
