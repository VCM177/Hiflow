'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AuthUser, Permission } from '@hiflow/shared-types';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import { describeApiError } from '@/lib/api/describe-error';
import { endSession, fetchSession, sessionQueryKey } from '@/lib/auth/session';
import { can as hasPermission } from '@/lib/permissions';

interface SessionValue {
  user: AuthUser;
  /** Whether the user's role grants `permission`. The API still enforces it. */
  can: (permission: Permission) => boolean;
  /** Ends the session, empties the cache and goes to the login page. */
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = React.useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

function SessionLoading() {
  return (
    <div
      role="status"
      className="flex min-h-screen flex-col gap-4 bg-hf-bg-page p-8"
    >
      <span className="sr-only">Đang tải phiên làm việc</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full max-w-3xl" />
    </div>
  );
}

function SessionError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  // A 401 is already on its way to the login page (the API client redirects).
  if (error instanceof ApiError && error.status === 401) {
    return <SessionLoading />;
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hf-bg-page p-8 text-center">
      <p role="alert" className="text-hf-text-heading">
        Không tải được thông tin đăng nhập. Vui lòng thử lại.
      </p>
      <Button variant="primary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

/**
 * Loads `GET /auth/me` once and shares the user with the whole signed-in area.
 * Nothing under it renders until the user is known, so a screen never has to
 * handle "no session yet".
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchSession(signal),
  });
  const user = query.data;

  const value = React.useMemo<SessionValue | null>(() => {
    if (!user) return null;
    return {
      user,
      can: (permission) => hasPermission(user.permissions, permission),
      signOut: async () => {
        try {
          await endSession();
        } catch (error) {
          // The cookie is still valid, so staying signed in is the honest state.
          toast.error(describeApiError(error).message);
          return;
        }
        queryClient.clear();
        router.replace('/login');
      },
    };
  }, [user, queryClient, router]);

  if (query.isError) {
    return (
      <SessionError error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  if (!value) return <SessionLoading />;
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
