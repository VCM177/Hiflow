'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@hiflow/shared-types';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { ErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  createCatalogItem,
  deleteCatalogItem,
  updateCatalogItem,
  type CatalogItem,
} from './catalog-api';
import { CatalogFormDialog } from './catalog-form-dialog';
import type { CatalogFormValues } from './catalog-schema';
import { CatalogTable } from './catalog-table';
import {
  CATALOGS,
  CATALOG_KINDS,
  isCatalogKind,
  type CatalogKind,
} from './constants';

// Which dialog is showing. The form target and the entry to delete are kept after the
// dialog closes, so the text does not change while it fades out.
interface DialogState {
  form: { item: CatalogItem | null; key: number } | null;
  formOpen: boolean;
  removing: CatalogItem | null;
  removeOpen: boolean;
}

type DialogAction =
  | { type: 'create' }
  | { type: 'edit'; item: CatalogItem }
  | { type: 'form-closed' }
  | { type: 'remove'; item: CatalogItem }
  | { type: 'remove-closed' };

const NO_DIALOG: DialogState = {
  form: null,
  formOpen: false,
  removing: null,
  removeOpen: false,
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'create':
      return {
        ...state,
        form: { item: null, key: (state.form?.key ?? 0) + 1 },
        formOpen: true,
      };
    case 'edit':
      return {
        ...state,
        form: { item: action.item, key: (state.form?.key ?? 0) + 1 },
        formOpen: true,
      };
    case 'form-closed':
      return { ...state, formOpen: false };
    case 'remove':
      return { ...state, removing: action.item, removeOpen: true };
    case 'remove-closed':
      return { ...state, removeOpen: false };
  }
}

/**
 * The Danh mục screen: departments and positions, one tab each. Mounted by the route
 * `catalogs/[kind]` with `key={kind}`, so changing tab starts with a clean state.
 */
export function CatalogsPage({ kind }: { kind: CatalogKind }) {
  const { can } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogs, dispatch] = React.useReducer(dialogReducer, NO_DIALOG);
  const catalog = CATALOGS[kind];

  // The menu shows this screen to whoever may create departments (the Admin).
  if (!can(PERMISSIONS.department.create)) {
    return <ErrorView kind="forbidden" />;
  }

  async function refreshList() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.entity(kind) });
  }

  async function save(values: CatalogFormValues) {
    const editing = dialogs.form?.item ?? null;
    if (editing) {
      await updateCatalogItem(catalog, editing.id, values);
    } else {
      await createCatalogItem(catalog, values);
    }
    await refreshList();
    toast.success(
      editing
        ? `Đã lưu ${values.name}`
        : `Đã thêm ${catalog.singular} ${values.name}`,
    );
  }

  async function remove() {
    const item = dialogs.removing;
    if (!item) return;
    await deleteCatalogItem(catalog, item.id);
    await refreshList();
    toast.success(`Đã xóa ${item.name}`);
  }

  return (
    <>
      <PageHeader
        title="Danh mục"
        description="Phòng ban và vị trí dùng trong các yêu cầu tuyển dụng."
        actions={
          <PermissionGate permission={catalog.permissions.create}>
            <Button
              variant="primary"
              onClick={() => dispatch({ type: 'create' })}
            >
              Thêm {catalog.singular}
            </Button>
          </PermissionGate>
        }
      />
      <Tabs
        value={kind}
        onValueChange={(next) => {
          if (isCatalogKind(next)) router.push(`/catalogs/${next}`);
        }}
      >
        <TabsList aria-label="Loại danh mục">
          {CATALOG_KINDS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {CATALOGS[tab].tabLabel}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={kind}>
          <CatalogTable
            catalog={catalog}
            onCreate={() => dispatch({ type: 'create' })}
            onEdit={(item) => dispatch({ type: 'edit', item })}
            onDelete={(item) => dispatch({ type: 'remove', item })}
          />
        </TabsContent>
      </Tabs>

      {dialogs.form && (
        <CatalogFormDialog
          key={dialogs.form.key}
          catalog={catalog}
          item={dialogs.form.item}
          open={dialogs.formOpen}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: 'form-closed' });
          }}
          onSubmit={save}
        />
      )}
      <ConfirmDialog
        open={dialogs.removeOpen}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'remove-closed' });
        }}
        title={`Xóa ${catalog.singular}`}
        description={
          dialogs.removing
            ? `Xóa "${dialogs.removing.name}"? Thao tác này không thể hoàn tác. Nếu đang được sử dụng thì sẽ không xóa được.`
            : ''
        }
        confirmLabel={`Xóa ${catalog.singular}`}
        onConfirm={remove}
      />
    </>
  );
}
