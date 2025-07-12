import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [HttpModule],
  controllers: [LeadsController],
  providers: [LeadsService, RedisService, AuthService],
})
export class LeadsModule {}
