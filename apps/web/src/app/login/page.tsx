import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/login-form';
import { safeNextPath } from '@/lib/auth/next-path';

export const metadata: Metadata = { title: 'Đăng nhập · Hiflow' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const requested = Array.isArray(next) ? next[0] : next;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-hf-container border border-hf-border bg-hf-bg-card p-6 shadow-hf-card">
        <h1 className="text-xl font-semibold text-hf-text-heading">
          Đăng nhập Hiflow
        </h1>
        <p className="mt-1 mb-6 text-sm text-hf-text-muted">
          Hệ thống quản lý tuyển dụng
        </p>
        <LoginForm next={safeNextPath(requested)} />
      </div>
    </main>
  );
}
