'use client';

import Link from 'next/link';

import { StatusPage } from '@/components/layout/status-page';
import { Button, buttonVariants } from '@/components/ui/button';

// The job board could not be read (the API is down or answered an error). Candidates see a
// plain message and can try again; nothing from the failure is shown.
export default function CareersError({ retry }: { retry: () => void }) {
  return (
    <StatusPage
      title="Chưa tải được danh sách vị trí"
      description="Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau ít phút."
      actions={
        <>
          <Button variant="primary" onClick={retry}>
            Thử lại
          </Button>
          <Link
            href="/careers"
            className={buttonVariants({ variant: 'secondary' })}
          >
            Về trang vị trí
          </Link>
        </>
      }
    />
  );
}
