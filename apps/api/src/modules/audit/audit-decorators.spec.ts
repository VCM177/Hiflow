import { Reflector } from '@nestjs/core';
import {
  AUDIT_EVENT_KEY,
  AuditEvent,
  AuditEventMeta,
  NO_AUDIT_KEY,
  NoAudit,
} from './audit.decorators';

class Sample {
  @AuditEvent('JOB_PUBLISHED')
  publish(this: void) {}

  @AuditEvent('APPLICATION_SUBMITTED_ONLINE', { conditional: true })
  submit(this: void) {}

  @NoAudit('read-only export that is audited by its own event')
  export(this: void) {}
}

describe('audit decorators', () => {
  const reflector = new Reflector();

  it('declare the event a route must record, conditional only when said so', () => {
    expect(
      reflector.get<AuditEventMeta>(AUDIT_EVENT_KEY, Sample.prototype.publish),
    ).toEqual({ event: 'JOB_PUBLISHED', conditional: false });
    expect(
      reflector.get<AuditEventMeta>(AUDIT_EVENT_KEY, Sample.prototype.submit),
    ).toEqual({ event: 'APPLICATION_SUBMITTED_ONLINE', conditional: true });
  });

  it('keep the reason a route has no event', () => {
    expect(
      reflector.get<string>(NO_AUDIT_KEY, Sample.prototype.export),
    ).toMatch(/audited by its own event/);
  });
});
