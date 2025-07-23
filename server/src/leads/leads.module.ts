import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis/redis.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [HttpModule, AuthModule, RedisModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
