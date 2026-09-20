import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from './common/cache/cache.module';
import { ThrottleModule } from './common/throttle/throttle.module';
import { validateEnv } from './config/env.validation';
import { dataSourceOptions } from './database/typeorm.config';
import { HealthModule } from './health/health.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { OffersModule } from './modules/offers/offers.module';
import { PositionsModule } from './modules/positions/positions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRoot(dataSourceOptions),
    CacheModule,
    ThrottleModule,
    AuthModule,
    ActivityLogsModule,
    StorageModule,
    DepartmentsModule,
    PositionsModule,
    UsersModule,
    RequisitionsModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
    InterviewsModule,
    OffersModule,
    DashboardModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
