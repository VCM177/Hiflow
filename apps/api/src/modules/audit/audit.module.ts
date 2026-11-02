import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditGuardCheck } from './audit-guard-check';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditRowChange } from './entities/audit-row-change.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, AuditRowChange])],
  providers: [AuditGuardCheck],
})
export class AuditModule {}
