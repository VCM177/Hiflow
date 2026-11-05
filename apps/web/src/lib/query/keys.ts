/**
 * Query keys: `[entity, 'list' | 'detail' | 'options', params]`. Every key starts with
 * the entity, so one invalidation (`queryKey: queryKeys.entity('job')`) clears all of
 * its lists, details and option lists after a write.
 */
export const queryKeys = {
  /** The root key of one entity: use it to invalidate everything about it. */
  entity: <TEntity extends string>(entity: TEntity) => [entity] as const,

  list: <TEntity extends string, TParams extends object>(
    entity: TEntity,
    params: TParams,
  ) => [entity, 'list', params] as const,

  detail: <TEntity extends string>(entity: TEntity, id: string) =>
    [entity, 'detail', id] as const,

  options: <TEntity extends string>(entity: TEntity, params?: object) =>
    [entity, 'options', params ?? {}] as const,
};
