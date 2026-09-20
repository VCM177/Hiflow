import { ValueTransformer } from 'typeorm';

/** Postgres returns `numeric` as string; expose it as number (or null). */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
