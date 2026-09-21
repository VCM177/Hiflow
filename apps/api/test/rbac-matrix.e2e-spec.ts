import {
  hasPermission,
  type Permission,
  permissionsForRole,
  UserRole,
} from '@hiflow/shared-types';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import request from 'supertest';
import { IS_PUBLIC_KEY } from './../src/common/decorators/public.decorator';
import { REQUIRED_PERMISSIONS_KEY } from './../src/common/decorators/require-permissions.decorator';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { FlowTokens, loginAll } from './helpers/flow';

const NIL = '00000000-0000-4000-8000-000000000000';

// Every route by every role is a few hundred real requests: allow for that.
jest.setTimeout(120_000);

interface Route {
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
function collectRoutes(ctx: E2eContext): Route[] {
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

const concrete = (path: string): string =>
  path.replace(':type', 'job-results').replace(/:[A-Za-z]+/g, NIL);

// Routes that need a login but no particular permission: everyone signed in
// may use their own profile. Anything else must declare a permission.
const LOGIN_ONLY = new Set([
  'get /auth/me',
  'get /profile',
  'patch /profile',
  'post /profile/change-password',
]);

const ROLES: [keyof FlowTokens, UserRole][] = [
  ['admin', UserRole.ADMIN],
  ['hr', UserRole.HR_MANAGER],
  ['manager', UserRole.DEPT_MANAGER],
  ['recruiter', UserRole.RECRUITER],
  ['interviewer', UserRole.INTERVIEWER],
];

describe('Permission matrix, every route by every role (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let routes: Route[];

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    routes = collectRoutes(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('finds the whole API, so the matrix cannot silently shrink', () => {
    expect(routes.length).toBeGreaterThanOrEqual(76);
    expect(
      routes
        .filter((route) => route.isPublic)
        .map((r) => r.key)
        .sort(),
    ).toEqual(
      [
        'get /health',
        'post /auth/login',
        'post /auth/logout',
        'get /public/jobs',
        'get /public/jobs/:id',
        'post /public/jobs/:id/applications',
      ].sort(),
    );
  });

  it('leaves no route open to every signed-in user unless it is on the short profile list', () => {
    const undeclared = routes
      .filter(
        (route) =>
          !route.isPublic &&
          (route.required === undefined || route.required.length === 0) &&
          !LOGIN_ONLY.has(route.key),
      )
      .map((route) => route.key);

    expect(undeclared).toEqual([]);
  });

  describe.each(ROLES)('%s', (who, role) => {
    const held = permissionsForRole(role);
    const guarded = () =>
      collectGuarded(routes).map((route) => ({
        route,
        allowed: route.required.every((p) => hasPermission(held, p)),
      }));

    it('is refused (403) exactly where its permissions fall short, and never where they suffice', async () => {
      const wrong: string[] = [];

      for (const { route, allowed } of guarded()) {
        const response = await request(ctx.server)
          [route.method](concrete(route.path))
          .set(bearer(t[who]))
          .send({});
        const refused = response.status === 403;

        if (refused === allowed) {
          wrong.push(
            `${route.key}: ${allowed ? 'should be allowed' : 'should be refused'}, got ${response.status}`,
          );
        }
      }

      expect(wrong).toEqual([]);
    });

    it('cannot change anything with an empty request, on any route it may reach', async () => {
      const changed: string[] = [];

      for (const { route, allowed } of guarded()) {
        if (!allowed || route.method === 'get') continue;

        const response = await request(ctx.server)
          [route.method](concrete(route.path))
          .set(bearer(t[who]))
          .send({});

        if (response.status >= 200 && response.status < 300) {
          changed.push(`${route.key} -> ${response.status}`);
        }
      }

      expect(changed).toEqual([]);
    });
  });
});

function collectGuarded(
  routes: Route[],
): (Route & { required: Permission[] })[] {
  return routes.filter(
    (route): route is Route & { required: Permission[] } =>
      !route.isPublic && !!route.required && route.required.length > 0,
  );
}
