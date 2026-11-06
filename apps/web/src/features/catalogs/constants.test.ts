import { PERMISSIONS } from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import { CATALOG_KINDS, CATALOGS, isCatalogKind } from './constants';

describe('catalog definitions', () => {
  it('defines every kind, keyed by itself', () => {
    for (const kind of CATALOG_KINDS) {
      expect(CATALOGS[kind].kind).toBe(kind);
    }
  });

  it('points each kind at its own API route and permissions', () => {
    expect(CATALOGS.department.path).toBe('/departments');
    expect(CATALOGS.department.permissions).toEqual({
      create: PERMISSIONS.department.create,
      update: PERMISSIONS.department.update,
      delete: PERMISSIONS.department.delete,
    });
    expect(CATALOGS.position.path).toBe('/positions');
    expect(CATALOGS.position.permissions).toEqual({
      create: PERMISSIONS.position.create,
      update: PERMISSIONS.position.update,
      delete: PERMISSIONS.position.delete,
    });
  });
});

describe('isCatalogKind', () => {
  it('accepts the known kinds only', () => {
    expect(isCatalogKind('department')).toBe(true);
    expect(isCatalogKind('position')).toBe(true);
    expect(isCatalogKind('departments')).toBe(false);
    expect(isCatalogKind('')).toBe(false);
    expect(isCatalogKind('__proto__')).toBe(false);
  });
});
