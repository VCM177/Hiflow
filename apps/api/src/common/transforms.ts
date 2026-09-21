/** class-transformer helpers shared by every DTO that takes text from a person. */

export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const normaliseEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// "090 123-4567" and "090.123.4567" are common ways to type the same number.
export const normalisePhone = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/[\s.\-()]/g, '') : value;

/** Vietnamese numbers, as typed after `normalisePhone`. */
export const VN_PHONE = /^(?:\+84|0)\d{9,10}$/;
