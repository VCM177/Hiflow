import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditGuardCheck } from './audit-guard-check';
import { AuditVerifierInterceptor } from './audit-verifier.interceptor';
import { AuditService } from './audit.service';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditRowChange } from './entities/audit-row-change.entity';
import { TxRunner } from './tx-runner.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, AuditRowChange])],
  providers: [
    AuditGuardCheck,
    TxRunner,
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditVerifierInterceptor },
  ],
  exports: [TxRunner, AuditService],
})
export class AuditModule {}
