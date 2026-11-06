import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';

/**
 * A small real form for testing a field: React Hook Form with a Zod resolver and a
 * "Gửi" button. `children` receives the form so a test can render fields on its
 * `control` or call `setError`. `onSubmit` only runs when the schema accepts the values.
 */
export function FormHarness<TValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
}: {
  schema: z.ZodType;
  defaultValues: DefaultValues<TValues>;
  onSubmit: SubmitHandler<TValues>;
  children: (form: UseFormReturn<TValues>) => React.ReactNode;
}) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema as never) as Resolver<TValues>,
    defaultValues,
  });
  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      {children(form)}
      <button type="submit">Gửi</button>
    </form>
  );
}
