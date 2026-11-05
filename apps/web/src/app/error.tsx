'use client';

import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/layout/status-page';

// The last net, outside the signed-in area (for example the login page).
export default function RootError({ retry }: { retry: () => void }) {
  return (
    <StatusPage
      title="Có lỗi xảy ra"
      description="Trang không hiển thị được. Vui lòng thử lại."
      actions={
        <Button variant="primary" onClick={retry}>
          Thử lại
        </Button>
      }
    />
  );
}
