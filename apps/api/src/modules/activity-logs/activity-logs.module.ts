import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogInterceptor } from './activity-log.interceptor';
import { ActivityLog } from './entities/activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor }],
})
export class ActivityLogsModule {}
