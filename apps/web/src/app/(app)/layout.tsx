import { AppShell } from '@/components/layout/app-shell';
import { SessionProvider } from '@/providers/session-provider';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
