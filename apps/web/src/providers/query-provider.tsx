'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query/client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client for the lifetime of this component, so a re-render keeps the cache.
  const [client] = React.useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
