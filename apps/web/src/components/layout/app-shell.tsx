'use client';

import * as React from 'react';
import { USER_ROLE_LABEL } from '@hiflow/shared-types';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { visibleNavGroups } from '@/config/navigation';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { useSession } from '@/providers/session-provider';

/** The signed-in frame: sidebar, top bar and the page area. Needs a SessionProvider above it. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useSession();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const groups = React.useMemo(
    () => visibleNavGroups(user.permissions),
    [user.permissions],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-hf-control bg-hf-bg-card px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:ring-hf-ring"
      >
        Bỏ qua menu
      </a>
      <div className="flex h-screen">
        <Sidebar
          groups={groups}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            fullName={user.fullName}
            email={user.email}
            roleLabel={USER_ROLE_LABEL[user.role]}
            onSignOut={() => void signOut()}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-6 outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
