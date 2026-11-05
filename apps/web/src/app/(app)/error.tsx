'use client';

import { ApiErrorView } from '@/components/layout/api-error-view';

// Inside the shell: the menu stays, only the page area shows the state.
export default function AppError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return <ApiErrorView error={error} onRetry={retry} />;
}
