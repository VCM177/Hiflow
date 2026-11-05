import Link from 'next/link';

import { StatusPage } from '@/components/layout/status-page';
import { buttonVariants } from '@/components/ui/button';

// For an address that matches no page. It has no session, so it links to "/":
// someone not signed in is sent to the login page from there.
export default function NotFound() {
  return (
    <StatusPage
      title="Không tìm thấy trang"
      description="Địa chỉ bạn mở không tồn tại."
      actions={
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          Về trang chính
        </Link>
      }
    />
  );
}
