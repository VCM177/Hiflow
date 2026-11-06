'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';

/** The in-app address a plain left click on this link would open, or null if the guard should not act. */
function internalTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const anchor =
    event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;

  const url = new URL(anchor.href, window.location.href);
  // Another site is covered by `beforeunload`.
  if (url.origin !== window.location.origin) return null;
  // A jump inside the same page loses nothing.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Put it on a full-page form. While `dirty` is true it asks before the person leaves:
 * the browser's own prompt for reload, close and typing another address, and a dialog
 * for any link inside the app (the menu, breadcrumbs, row links).
 *
 * Next.js offers no way to stop the Back button on the App Router, so Back is not guarded.
 * Programmatic navigation after a successful save (`router.push`) is not a click, so a
 * form that redirects on success needs no extra step.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [leaveTo, setLeaveTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Capture phase on the document runs before Next's Link handler, so stopping the
    // event here keeps the page from changing underneath the dialog.
    const interceptLink = (event: MouseEvent) => {
      const target = internalTarget(event);
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(target);
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', interceptLink, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', interceptLink, true);
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={leaveTo !== null}
      onOpenChange={(open) => {
        if (!open) setLeaveTo(null);
      }}
      title="Rời khỏi trang?"
      description="Các thay đổi chưa lưu sẽ bị mất."
      confirmLabel="Rời khỏi trang"
      onConfirm={() => {
        if (leaveTo !== null) router.push(leaveTo);
      }}
    />
  );
}
