import { SessionProvider } from '@/providers/session-provider';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return <SessionProvider>{children}</SessionProvider>;
}
