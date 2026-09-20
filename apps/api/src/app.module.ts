import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { dataSourceOptions } from './database/typeorm.config';
import { HealthModule } from './health/health.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PositionsModule } from './modules/positions/positions.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    ActivityLogsModule,
    StorageModule,
    DepartmentsModule,
    PositionsModule,
    UsersModule,
    RequisitionsModule,
    JobsModule,
    CandidatesModule,
    HealthModule,
  ],
})
export class AppModule {}
