import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { fetchAuditEvent, type AuditEventFull } from './audit-api';
import { AuditDetail } from './audit-detail';

vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ user: { permissions: [] }, can: () => true }),
}));
vi.mock('./audit-api', () => ({ fetchAuditEvent: vi.fn() }));

const base: AuditEventFull = {
  id: 'e1',
  occurredAt: '2026-11-06T03:15:00.000Z',
  event: 'USER_ROLE_CHANGED',
  label: 'Đổi vai trò người dùng',
  entityType: 'User',
  entityId: 'u2',
  actor: { id: 'a1', name: 'Quản Trị', role: 'ADMIN' },
  txId: 'tx1',
  requestId: 'req1',
  origin: 'app',
  ip: '10.0.0.1',
  userAgent: 'Mozilla/5.0',
  data: { from: 'RECRUITER', to: 'HR_MANAGER' },
  rowChanges: [
    {
      id: 'c1',
      op: 'U',
      tableName: 'users',
      rowId: 'u2',
      changes: {
        role: ['RECRUITER', 'HR_MANAGER'],
        password_hash: ['[REDACTED]', '[REDACTED]'],
      },
    },
    {
      id: 'c2',
      op: 'I',
      tableName: 'notes',
      rowId: 'n1',
      changes: { text: 'Mới' },
    },
    {
      id: 'c3',
      op: 'D',
      tableName: 'notes',
      rowId: 'n0',
      changes: { text: 'Cũ' },
    },
  ],
};

function renderDetail(event: AuditEventFull = base) {
  vi.mocked(fetchAuditEvent).mockResolvedValue(event);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuditDetail id="e1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('AuditDetail', () => {
  it('shows the event, the actor as they were, the source and the network details', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'Đổi vai trò người dùng' });
    expect(screen.getByText(/Quản Trị · Admin/)).toBeInTheDocument();
    expect(screen.getByText('Ứng dụng')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Mozilla/5.0')).toBeInTheDocument();
    expect(screen.getByText(/06\/11\/2026 10:15/)).toBeInTheDocument();
  });

  it('shows the event data as text', async () => {
    renderDetail();
    const pre = (await screen.findByText(/"from": "RECRUITER"/)).closest(
      'pre',
    )!;
    expect(pre).toHaveTextContent('"to": "HR_MANAGER"');
  });

  it('shows an update as old → new, an insert and a delete by their value, and keeps the password redacted', async () => {
    renderDetail();
    const list = await screen.findByRole('list', { name: 'Thay đổi dòng' });
    const [update, insert, remove] = within(list).getAllByRole('listitem');
    expect(update).toHaveTextContent('Sửa dòng');
    expect(update).toHaveTextContent('RECRUITER');
    expect(update).toHaveTextContent('→');
    expect(update).toHaveTextContent('HR_MANAGER');
    expect(update).toHaveTextContent('[REDACTED]');
    expect(insert).toHaveTextContent('Thêm dòng');
    expect(insert).toHaveTextContent('Mới');
    expect(remove).toHaveTextContent('Xóa dòng');
    expect(remove).toHaveTextContent('Cũ');
  });

  it('draws hostile text as text, never as markup', async () => {
    renderDetail({
      ...base,
      userAgent: '<img src=x onerror="window.__xss=1">',
      data: { note: '<script>window.__xss=1</script>' },
      rowChanges: [
        {
          id: 'c9',
          op: 'I',
          tableName: 't',
          rowId: 'r',
          changes: { title: '<b onmouseover=x>Tên</b>' },
        },
      ],
    });
    await screen.findByRole('heading', { name: 'Đổi vai trò người dùng' });
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
    expect(screen.getByText('<b onmouseover=x>Tên</b>')).toBeInTheDocument();
    expect(
      screen.getByText('<img src=x onerror="window.__xss=1">'),
    ).toBeInTheDocument();
  });

  it('breaks long unbroken values instead of widening the page', async () => {
    renderDetail({
      ...base,
      rowChanges: [
        {
          id: 'c8',
          op: 'I',
          tableName: 't',
          rowId: 'r',
          changes: { blob: 'x'.repeat(500) },
        },
      ],
    });
    const value = await screen.findByText('x'.repeat(500));
    expect(value.className).toContain('break-words');
  });

  it('says when there is no data or no row change, and names a visitor "Khách"', async () => {
    renderDetail({
      ...base,
      data: {},
      rowChanges: [],
      actor: { id: null, name: null, role: null },
    });
    expect(
      await screen.findByText('Sự kiện không có dữ liệu kèm theo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Không có thay đổi dòng nào.')).toBeInTheDocument();
    expect(screen.getByText('Khách')).toBeInTheDocument();
  });

  it('shows the not-found page for an unknown event', async () => {
    vi.mocked(fetchAuditEvent).mockRejectedValue(new ApiError(404, []));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuditDetail id="zzz" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
  });
});
