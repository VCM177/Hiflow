/**
 * What a value looks like after it went through `JSON.stringify` and back.
 * The API builds its views with `Date` objects; on the wire (and so in the web
 * app) every one of them is an ISO string. `Jsonified<JobView>` is therefore
 * the type of a job as the browser receives it. A nullable date stays nullable
 * (`Date | null` becomes `string | null`).
 */
export type Jsonified<T> = T extends Date
  ? string
  : T extends readonly unknown[]
    ? { [K in keyof T]: Jsonified<T[K]> }
    : T extends object
      ? { [K in keyof T]: Jsonified<T[K]> }
      : T;
