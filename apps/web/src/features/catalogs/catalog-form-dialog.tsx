'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { FormDialog } from '@/components/shared/form-dialog';

import type { CatalogItem } from './catalog-api';
import { catalogFormSchema, type CatalogFormValues } from './catalog-schema';
import type { CatalogDefinition } from './constants';

/**
 * Create (`item` is null) or edit one catalogue entry. The form is built from the entry
 * it opens on, so the page mounts a new one (by `key`) for each entry.
 */
export function CatalogFormDialog({
  catalog,
  item,
  open,
  onOpenChange,
  onSubmit,
}: {
  catalog: CatalogDefinition;
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CatalogFormValues) => Promise<void>;
}) {
  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: { name: item?.name ?? '', code: item?.code ?? '' },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `Sửa ${catalog.singular}` : `Thêm ${catalog.singular}`}
      submitLabel={item ? 'Lưu thay đổi' : `Thêm ${catalog.singular}`}
      form={form}
      onSubmit={onSubmit}
    >
      <RHFTextField
        control={form.control}
        name="name"
        label="Tên"
        required
        inputProps={{ maxLength: 100, autoComplete: 'off' }}
      />
      <RHFTextField
        control={form.control}
        name="code"
        label="Mã"
        required
        hint="2 đến 30 ký tự: chữ, số hoặc dấu gạch dưới."
        inputProps={{ maxLength: 30, autoComplete: 'off' }}
      />
    </FormDialog>
  );
}
