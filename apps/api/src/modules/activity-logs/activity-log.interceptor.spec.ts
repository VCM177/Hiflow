import { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { Repository } from 'typeorm';
import { ActivityLogInterceptor } from './activity-log.interceptor';
import { ActivityLog } from './entities/activity-log.entity';

interface FakeRequest {
  method: string;
  route?: { path: string };
  path?: string;
  params?: Record<string, string>;
  body?: unknown;
  user?: { id: string };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ActivityLogInterceptor', () => {
  const save = jest.fn();
  const create = jest.fn((entity: Partial<ActivityLog>) => entity);
  const interceptor = new ActivityLogInterceptor({
    save,
    create,
  } as unknown as Repository<ActivityLog>);

  const run = async (
    request: FakeRequest,
    response: unknown = { id: 'r-1' },
  ) => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: <T>() => request as unknown as T }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(response) };

    const result = await lastValueFrom(interceptor.intercept(context, next));
    await flush();
    return result;
  };

  beforeEach(() => {
    save.mockReset().mockResolvedValue(undefined);
    create.mockClear();
  });

  it('does not record GET requests', async () => {
    await run({ method: 'GET', route: { path: '/requisitions' } });

    expect(save).not.toHaveBeenCalled();
  });

  it('does not record the login route, even though it is a POST', async () => {
    await run({
      method: 'POST',
      route: { path: '/auth/login' },
      body: { email: 'a@hiflow.local', password: 'hunter2' },
    });

    expect(save).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'records %s requests',
    async (method) => {
      await run({ method, route: { path: '/jobs' }, user: { id: 'u-1' } });

      expect(save).toHaveBeenCalledTimes(1);
    },
  );

  it('records who did what to which entity', async () => {
    await run(
      {
        method: 'POST',
        route: { path: '/requisitions' },
        body: { title: 'QA engineer' },
        user: { id: 'u-1' },
      },
      { id: 'req-9', title: 'QA engineer' },
    );

    expect(create).toHaveBeenCalledWith({
      actorId: 'u-1',
      action: 'POST',
      entityType: 'Requisition',
      entityId: 'req-9',
      payload: { route: '/requisitions', body: { title: 'QA engineer' } },
    });
  });

  it('takes the entity id from the URL when present', async () => {
    await run(
      {
        method: 'PATCH',
        route: { path: '/candidates/:id' },
        params: { id: 'cand-3' },
        user: { id: 'u-1' },
      },
      { ok: true },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'Candidate', entityId: 'cand-3' }),
    );
  });

  it('keeps the route pattern so state-changing sub-routes are distinguishable', async () => {
    await run({
      method: 'POST',
      route: { path: '/requisitions/:id/approve' },
      params: { id: 'req-1' },
      user: { id: 'u-1' },
    });

    const [entity] = create.mock.calls[0];
    expect(entity.payload?.route).toBe('/requisitions/:id/approve');
  });

  it('never stores a password from the request body', async () => {
    await run({
      method: 'POST',
      route: { path: '/users' },
      body: { email: 'new@hiflow.local', password: 'hunter2' },
      user: { id: 'u-1' },
    });

    const stored = JSON.stringify(create.mock.calls[0][0]);
    expect(stored).not.toContain('hunter2');
    expect(stored).toContain('[REDACTED]');
  });

  it('records an unauthenticated write with a null actor', async () => {
    await run({ method: 'POST', route: { path: '/jobs' } });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null }),
    );
  });

  it('names an unmapped resource from its URL segment', async () => {
    await run({ method: 'POST', route: { path: '/widgets' } });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'Widgets' }),
    );
  });

  it('returns the handler response unchanged', async () => {
    const result = await run(
      { method: 'POST', route: { path: '/jobs' } },
      { id: 'j-1', title: 'Designer' },
    );

    expect(result).toEqual({ id: 'j-1', title: 'Designer' });
  });

  it('still returns the response when the audit write fails', async () => {
    save.mockRejectedValue(new Error('database unavailable'));

    const result = await run({ method: 'POST', route: { path: '/jobs' } });

    expect(result).toEqual({ id: 'r-1' });
  });
});
