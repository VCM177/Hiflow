import Link from 'next/link';

export default function CareersLayout({ children }: LayoutProps<'/careers'>) {
  return (
    <div className="flex min-h-screen flex-col bg-hf-bg-page">
      <header className="border-b border-hf-border bg-hf-bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/careers"
            className="text-lg font-semibold text-hf-text-heading"
          >
            Hiflow
          </Link>
          <span className="text-sm text-hf-text-muted">Cơ hội nghề nghiệp</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
