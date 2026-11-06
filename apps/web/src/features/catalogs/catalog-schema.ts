import { z } from 'zod';

import { categoryCodeSchema } from '@/lib/validations';

/** The create and edit form of a catalogue item. The API accepts a name up to 100 characters. */
export const catalogFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Vui lòng nhập tên.' })
    .max(100, { error: 'Tên tối đa 100 ký tự.' }),
  code: categoryCodeSchema,
});

export type CatalogFormValues = z.infer<typeof catalogFormSchema>;
