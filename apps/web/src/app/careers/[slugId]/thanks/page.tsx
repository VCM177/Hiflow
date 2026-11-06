import type { Metadata } from 'next';
import Link from 'next/link';

import { StatusPage } from '@/components/layout/status-page';
import { buttonVariants } from '@/components/ui/button';
import { EXPECTED_RESPONSE_TIME } from '@/features/careers/constants';

export const metadata: Metadata = {
  title: 'Đã nhận hồ sơ · Hiflow',
  robots: { index: false },
};

// The same words for everyone: nothing here says whether this person applied before,
// or whether this job still exists.
export default function ThanksPage() {
  return (
    <StatusPage
      title="Chúng tôi đã nhận hồ sơ của bạn"
      description={`Hiflow sẽ phản hồi ${EXPECTED_RESPONSE_TIME}. Vui lòng để ý email và điện thoại của bạn.`}
      actions={
        <Link
          href="/careers"
          className={buttonVariants({ variant: 'secondary' })}
        >
          Xem các vị trí khác
        </Link>
      }
    />
  );
}
