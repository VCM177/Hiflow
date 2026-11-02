import {
  AUDIT_CATALOGUE_COMPLETE,
  AUDIT_EVENT_NAMES,
  AUDIT_EVENTS,
  auditEventLabel,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  UserRole,
} from '@hiflow/shared-types';

describe('audit event catalogue', () => {
  it('lists every event once, with a label and an entity type', () => {
    expect(AUDIT_CATALOGUE_COMPLETE).toBe(true);
    expect(new Set(AUDIT_EVENT_NAMES).size).toBe(AUDIT_EVENT_NAMES.length);

    for (const name of AUDIT_EVENT_NAMES) {
      const { label, entityType } = AUDIT_EVENTS[name];
      expect(label.trim()).not.toBe('');
      expect(entityType).toMatch(/^[A-Z][A-Za-z]+$/);
      // The database column is varchar(32) and the code varchar(64).
      expect(entityType.length).toBeLessThanOrEqual(32);
      expect(name.length).toBeLessThanOrEqual(64);
      expect(name).toMatch(/^[A-Z][A-Z_]+$/);
    }
  });

  it('gives each label only once, so a reader can tell events apart', () => {
    const labels = AUDIT_EVENT_NAMES.map((name) => AUDIT_EVENTS[name].label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('falls back to the raw code for an event it does not know', () => {
    expect(auditEventLabel('REQUISITION_APPROVED')).toBe(
      'Duyệt yêu cầu tuyển dụng',
    );
    expect(auditEventLabel('SOMETHING_OLD')).toBe('SOMETHING_OLD');
  });

  it('lets only the admin read or export the trail', () => {
    for (const role of Object.values(UserRole)) {
      const granted = ROLE_PERMISSIONS[role];
      const reads =
        granted.includes(PERMISSIONS.audit.eventView) || granted.includes('*');

      expect(reads).toBe(role === UserRole.ADMIN);
    }
    expect(ROLE_PERMISSIONS[UserRole.ADMIN]).toContain('*');
    expect(PERMISSIONS.audit.eventExport).toBe('audit.event.export');
  });
});
