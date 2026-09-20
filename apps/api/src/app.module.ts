import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { dataSourceOptions } from './database/typeorm.config';
import { HealthModule } from './health/health.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PositionsModule } from './modules/positions/positions.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    ActivityLogsModule,
    StorageModule,
    DepartmentsModule,
    PositionsModule,
    HealthModule,
  ],
})
export class AppModule {}
