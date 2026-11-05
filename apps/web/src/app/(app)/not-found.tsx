'use client';

import { ErrorView } from '@/components/layout/api-error-view';

export default function AppNotFound() {
  return <ErrorView kind="not-found" />;
}
