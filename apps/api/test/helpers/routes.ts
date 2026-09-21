import type { Permission } from '@hiflow/shared-types';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './../../src/common/decorators/public.decorator';
import { REQUIRED_PERMISSIONS_KEY } from './../../src/common/decorators/require-permissions.decorator';
import type { E2eContext } from './e2e-app';

export interface Route {
  key: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  required: Permission[] | undefined;
  isPublic: boolean;
}

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? (value as string[]) : [value as string];

/**
 * Every route the running application really serves, read from the same
 * metadata the guards read, so a new route cannot be left out of this matrix.
 */
export function collectRoutes(ctx: E2eContext): Route[] {
  const routes: Route[] = [];

  for (const module of ctx.app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller) continue;

      const base = asList(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      const proto = controller.prototype as Record<string, unknown>;

      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== 'function') continue;
        const verb = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (verb === undefined) continue;

        const own = asList(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
        const path = `/${[base[0], own[0]].filter(Boolean).join('/')}`
          .replace(/\/+/g, '/')
          .replace(/\/$/, '');
        const method = RequestMethod[verb].toLowerCase() as Route['method'];
        const metaOf = (key: string): unknown =>
          (Reflect.getMetadata(key, handler) as unknown) ??
          (Reflect.getMetadata(key, controller) as unknown);

        routes.push({
          key: `${method} ${path}`,
          method,
          path,
          required: metaOf(REQUIRED_PERMISSIONS_KEY) as
            Permission[] | undefined,
          isPublic: metaOf(IS_PUBLIC_KEY) === true,
        });
      }
    }
  }

  return routes;
}
