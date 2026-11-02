import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from '../audit/entities/audit-event.entity';
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
      AuditEvent,
    ]),
  ],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
})
export class RequisitionsModule {}
