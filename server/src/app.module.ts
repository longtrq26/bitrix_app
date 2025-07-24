import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { typeOrmConfig } from './config/database.config';
import { LeadsModule } from './leads/leads.module';
import { RedisModule } from './redis/redis.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WinstonModule.forRoot({
      transports: [
        new transports.Console({
          format: format.combine(format.timestamp(), format.json()),
        }),
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' }),
      ],
    }),
    TypeOrmModule.forRoot(typeOrmConfig),

    HttpModule,
    RedisModule,
    AuthModule,
    LeadsModule,
    WebhookModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
