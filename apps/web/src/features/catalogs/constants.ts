import { PERMISSIONS, type Permission } from '@hiflow/shared-types';

export const CATALOG_KINDS = ['department', 'position'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

/** The columns the API lets a catalogue list sort by (`CatalogListQueryDto.sortBy`). */
export const CATALOG_SORT_KEYS = ['name', 'code', 'createdAt'] as const;
export type CatalogSortKey = (typeof CATALOG_SORT_KEYS)[number];

export interface CatalogDefinition {
  kind: CatalogKind;
  /** The API route of the list. */
  path: string;
  /** The tab and the heading: "Phòng ban". */
  tabLabel: string;
  /** The noun inside a sentence: "phòng ban". */
  singular: string;
  permissions: { create: Permission; update: Permission; delete: Permission };
}

const P = PERMISSIONS;

export const CATALOGS: Record<CatalogKind, CatalogDefinition> = {
  department: {
    kind: 'department',
    path: '/departments',
    tabLabel: 'Phòng ban',
    singular: 'phòng ban',
    permissions: {
      create: P.department.create,
      update: P.department.update,
      delete: P.department.delete,
    },
  },
  position: {
    kind: 'position',
    path: '/positions',
    tabLabel: 'Vị trí',
    singular: 'vị trí',
    permissions: {
      create: P.position.create,
      update: P.position.update,
      delete: P.position.delete,
    },
  },
};

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}
