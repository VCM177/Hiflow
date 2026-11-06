import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';

import { ComponentGallery } from './gallery';

// Development only: sample data for looking at the shared components. It must never be
// served in production.
export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <PageHeader
        title="Thành phần dùng chung"
        description="Trang xem thử, chỉ có khi phát triển."
      />
      <ComponentGallery />
    </main>
  );
}
