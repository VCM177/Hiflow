import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

import { downloadFile, filenameFrom } from './download';
import { ApiError } from './errors';

describe('filenameFrom', () => {
  it('reads a quoted name', () => {
    expect(filenameFrom('attachment; filename="bao-cao.csv"', 'x.csv')).toBe(
      'bao-cao.csv',
    );
  });
  it('reads an unquoted and an encoded name', () => {
    expect(filenameFrom('attachment; filename=a.csv', 'x.csv')).toBe('a.csv');
    expect(
      filenameFrom("attachment; filename*=UTF-8''b%C3%A1o.csv", 'x.csv'),
    ).toBe('báo.csv');
  });
  it('falls back without a header', () => {
    expect(filenameFrom(null, 'x.csv')).toBe('x.csv');
    expect(filenameFrom('inline', 'x.csv')).toBe('x.csv');
  });
});

describe('downloadFile', () => {
  let click: MockInstance;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('asks for the file with the filters and starts a download under the server’s name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('a,b\n1,2\n', {
        headers: {
          'Content-Disposition': 'attachment; filename="tien-do.csv"',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const name = await downloadFile('/reports/job-results/export', {
      from: '2026-10-01',
      departmentId: undefined,
    });
    expect(name).toBe('tien-do.csv');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reports/job-results/export?from=2026-10-01',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'tien-do.csv',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('turns a refusal into an ApiError and downloads nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );
    await expect(downloadFile('/x')).rejects.toMatchObject({ status: 403 });
    expect(click).not.toHaveBeenCalled();
  });

  it('reports a network failure as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(downloadFile('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
