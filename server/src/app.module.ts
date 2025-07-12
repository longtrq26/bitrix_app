import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { RedisService } from './redis/redis.service';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from './logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    LoggerModule,
    AuthModule,
    LeadsModule,
  ],
  controllers: [AuthController],
  providers: [RedisService, AuthService],
})
export class AppModule {}
