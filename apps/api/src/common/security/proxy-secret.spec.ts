import type { NextFunction, Request, Response } from 'express';
import { PROXY_SECRET_HEADER, proxySecretMiddleware } from './proxy-secret';

const requestWith = (header?: string): Request =>
  ({
    method: 'GET',
    path: '/jobs',
    header: (name: string) =>
      name.toLowerCase() === PROXY_SECRET_HEADER ? header : undefined,
  }) as unknown as Request;

const responseSpy = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
};

describe('proxySecretMiddleware', () => {
  const middleware = proxySecretMiddleware('correct-secret');

  it('lets a request with the right secret through', () => {
    const next = jest.fn() as NextFunction;
    const { res, status } = responseSpy();

    middleware(requestWith('correct-secret'), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', undefined],
    ['an empty header', ''],
    ['a wrong secret', 'wrong-secret'],
    ['a longer value that starts with the secret', 'correct-secret-and-more'],
  ])('answers 404 like an unknown route for %s', (_label, header) => {
    const next = jest.fn() as NextFunction;
    const { res, status, json } = responseSpy();

    middleware(requestWith(header), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      message: 'Cannot GET /jobs',
      error: 'Not Found',
      statusCode: 404,
    });
  });
});
