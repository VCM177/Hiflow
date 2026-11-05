'use client';

import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { StatusPage } from '@/components/layout/status-page';
import { ApiError } from '@/lib/api/errors';
import { landingPathFor } from '@/lib/auth/landing';
import { useCountdown } from '@/hooks/use-countdown';
import { useSession } from '@/providers/session-provider';
import { cn } from '@/lib/utils';

export type ErrorViewKind = 'forbidden' | 'not-found' | 'busy' | 'failed';

/** What an error means for a whole page, by the status the API answered (docs 1.3). */
export function errorViewKindOf(error: unknown): ErrorViewKind {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    // Out of scope answers 404 too: the page never says which it was.
    if (error.status === 404) return 'not-found';
    if (error.status === 429) return 'busy';
  }
  return 'failed';
}

function HomeLink() {
  const { user } = useSession();
  return (
    <Link
      href={landingPathFor(user.permissions)}
      className={cn(buttonVariants({ variant: 'secondary' }))}
    >
      Về trang chính
    </Link>
  );
}

/** A full-page state inside the signed-in shell. */
export function ErrorView({
  kind,
  retryAfter,
  onRetry,
}: {
  kind: ErrorViewKind;
  /** Seconds to wait before retrying, from a 429. */
  retryAfter?: number;
  onRetry?: () => void;
}) {
  const { secondsLeft } = useCountdown(
    kind === 'busy' ? retryAfter : undefined,
  );

  if (kind === 'forbidden') {
    return (
      <StatusPage
        title="Không có quyền truy cập"
        description="Tài khoản của bạn không được xem trang này. Nếu cần, hãy liên hệ quản trị viên."
        actions={<HomeLink />}
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <StatusPage
        title="Không tìm thấy trang"
        description="Trang bạn tìm không tồn tại hoặc bạn không có quyền xem."
        actions={<HomeLink />}
      />
    );
  }
  const busy = kind === 'busy';
  return (
    <StatusPage
      title={busy ? 'Bạn thao tác quá nhanh' : 'Không tải được trang'}
      description={
        busy
          ? secondsLeft > 0
            ? `Vui lòng thử lại sau ${secondsLeft} giây.`
            : 'Bạn có thể thử lại ngay bây giờ.'
          : 'Có lỗi xảy ra, vui lòng thử lại. Dữ liệu bạn đã nhập không bị mất.'
      }
      actions={
        onRetry && (
          <Button
            variant="primary"
            onClick={onRetry}
            disabled={busy && secondsLeft > 0}
          >
            Thử lại
          </Button>
        )
      }
    />
  );
}

/** Picks the right full-page state for an error thrown while loading a page. */
export function ApiErrorView({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <ErrorView
      kind={errorViewKindOf(error)}
      retryAfter={error instanceof ApiError ? error.retryAfter : undefined}
      onRetry={onRetry}
    />
  );
}
