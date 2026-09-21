import { OpenAPIObject } from '@nestjs/swagger';
import { createE2eApp, E2eContext } from './helpers/e2e-app';
import { buildSwaggerDocument } from './../src/swagger';

type Operation = {
  responses: Record<string, { description?: string; headers?: object }>;
  [extension: string]: unknown;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const operationsOf = (document: OpenAPIObject) =>
  Object.entries(document.paths).flatMap(([path, item]) =>
    METHODS.filter((method) => method in item).map((method) => ({
      key: `${method} ${path}`,
      operation: (item as Record<string, Operation>)[method],
    })),
  );

describe('OpenAPI contract (e2e)', () => {
  let ctx: E2eContext;
  let document: OpenAPIObject;

  beforeAll(async () => {
    process.env.PUBLIC_API_URL = 'https://hiflow-api-example.a.run.app';
    ctx = await createE2eApp();
    document = buildSwaggerDocument(ctx.app);
  });

  afterAll(async () => {
    delete process.env.PUBLIC_API_URL;
    await ctx.app.close();
  });

  it('lists where the API lives: local, through the web proxy, and production', () => {
    const servers = document.servers ?? [];

    expect(servers.map((server) => server.url)).toEqual([
      'http://localhost:4000',
      '/api',
      'https://hiflow-api-example.a.run.app',
    ]);
    expect(servers[1].description).toContain('proxy');
    expect(servers[2].description).toBe('Production (Cloud Run)');
  });

  it('leaves the production server out when PUBLIC_API_URL is not set', () => {
    delete process.env.PUBLIC_API_URL;

    const without = buildSwaggerDocument(ctx.app);

    expect(without.servers?.map((server) => server.url)).toEqual([
      'http://localhost:4000',
      '/api',
    ]);
  });

  it('declares both ways of authenticating: the session cookie and a Bearer token', () => {
    expect(document.components?.securitySchemes).toMatchObject({
      bearer: { type: 'http', scheme: 'bearer' },
      cookie: { type: 'apiKey', in: 'cookie', name: 'hf_access_token' },
    });
  });

  it('explains the error codes the web app must handle', () => {
    for (const code of ['401', '403', '404', '409', '429']) {
      expect(document.info.description).toContain(code);
    }
  });

  describe('401', () => {
    it('is documented on every operation that needs a login, and only on those', () => {
      const missing: string[] = [];
      const wrong: string[] = [];

      for (const { key, operation } of operationsOf(document)) {
        const isPublic = 'x-public' in operation;
        const has401 = '401' in operation.responses;

        if (!isPublic && !has401) missing.push(key);
        // Login answers 401 for bad credentials, so it documents that itself.
        if (isPublic && has401 && key !== 'post /auth/login') wrong.push(key);
      }

      expect(missing).toEqual([]);
      expect(wrong).toEqual([]);
    });

    it('marks exactly the routes the guard test treats as public', () => {
      const publicRoutes = operationsOf(document)
        .filter(({ operation }) => 'x-public' in operation)
        .map(({ key }) => key)
        .sort();

      expect(publicRoutes).toEqual(
        [
          'get /health',
          'post /auth/login',
          'post /auth/logout',
          'get /public/jobs',
          'get /public/jobs/{id}',
          'post /public/jobs/{id}/applications',
        ].sort(),
      );
    });
  });

  describe('403', () => {
    const operations = () =>
      new Map(
        operationsOf(document).map(({ key, operation }) => [key, operation]),
      );

    it('is documented on routes that need a permission', () => {
      const all = operations();

      for (const key of [
        'get /users',
        'post /requisitions',
        'get /candidates',
        'get /candidates/{id}/cv',
        'get /activity-logs',
      ]) {
        expect(all.get(key)?.responses).toHaveProperty('403');
      }
    });

    it('is documented on login for a locked account, and not on public utility routes', () => {
      const all = operations();

      expect(all.get('post /auth/login')?.responses['403'].description).toBe(
        'Tài khoản đã bị khóa',
      );
      expect(all.get('get /health')?.responses).not.toHaveProperty('403');
      expect(all.get('post /auth/logout')?.responses).not.toHaveProperty('403');
    });
  });

  describe('429', () => {
    it('is documented, with its Retry-After header, on the rate-limited routes', () => {
      const login = operationsOf(document).find(
        ({ key }) => key === 'post /auth/login',
      )!.operation;

      const tooMany = login.responses['429'];

      expect(tooMany.description).toContain('Retry-After');
      expect(Object.keys(tooMany.headers ?? {})).toEqual(['Retry-After']);
    });

    it('is documented on the public job board too', () => {
      const all = new Map(
        operationsOf(document).map(({ key, operation }) => [key, operation]),
      );

      for (const key of ['get /public/jobs', 'get /public/jobs/{id}']) {
        expect(all.get(key)?.responses).toHaveProperty('429');
      }
    });

    it('is not claimed on routes that have no rate limit', () => {
      const users = operationsOf(document).find(
        ({ key }) => key === 'get /users',
      )!.operation;

      expect(users.responses).not.toHaveProperty('429');
    });
  });
});
