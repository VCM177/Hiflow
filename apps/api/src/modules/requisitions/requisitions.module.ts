import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from '../activity-logs/entities/activity-log.entity';
import { Department } from '../departments/entities/department.entity';
import { JobPosition } from '../positions/entities/job-position.entity';
import { Requisition } from './entities/requisition.entity';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Requisition,
      Department,
      JobPosition,
      ActivityLog,
    ]),
  ],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
})
export class RequisitionsModule {}
