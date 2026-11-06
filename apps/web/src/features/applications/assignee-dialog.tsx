'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useUserOptions } from '@/features/users/options';

export const NO_ASSIGNEE = 'none';

const schema = z.object({ assigneeId: z.string().min(1) });
export type AssigneeValues = z.infer<typeof schema>;

/** Choose who owns the application; "Chưa phân công" takes it away from its owner. */
export function AssigneeDialog({
  current,
  open,
  onOpenChange,
  onSubmit,
}: {
  current: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AssigneeValues) => Promise<void>;
}) {
  const assignees = useUserOptions('ASSIGNEE');
  const form = useForm<AssigneeValues>({
    resolver: zodResolver(schema),
    defaultValues: { assigneeId: current ?? NO_ASSIGNEE },
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Đổi người phụ trách"
      submitLabel="Lưu"
      form={form}
      onSubmit={onSubmit}
    >
      <RHFSelectField
        control={form.control}
        name="assigneeId"
        label="Người phụ trách"
        selectProps={{
          options: [
            { value: NO_ASSIGNEE, label: 'Chưa phân công' },
            ...assignees.options,
          ],
        }}
      />
    </FormDialog>
  );
}
