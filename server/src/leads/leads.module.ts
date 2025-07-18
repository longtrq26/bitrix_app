import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [
    HttpModule,
    AuthModule,
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672',
      exchanges: [
        {
          name: 'bitrix_exchange',
          type: 'topic',
        },
      ],
      connectionInitOptions: { wait: true },
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, RedisService, AuthService],
})
export class LeadsModule {}
