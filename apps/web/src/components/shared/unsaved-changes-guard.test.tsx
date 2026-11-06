import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UnsavedChangesGuard } from './unsaved-changes-guard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// jsdom cannot navigate. This listener runs last (bubbling) and swallows the click the
// guard did not stop, so a test can tell "the page would have changed" from "it was held".
let reachedThePage: string[] = [];
const swallow = (event: MouseEvent) => {
  const anchor = (event.target as Element).closest('a');
  if (anchor) reachedThePage.push(anchor.getAttribute('href') ?? '');
  event.preventDefault();
};
beforeEach(() => {
  reachedThePage = [];
  push.mockClear();
  document.addEventListener('click', swallow);
});
afterEach(() => {
  document.removeEventListener('click', swallow);
});

function renderGuard(dirty: boolean) {
  return render(
    <>
      <UnsavedChangesGuard dirty={dirty} />
      <Link href="/jobs">Tin tuyển dụng</Link>
      <Link href="/jobs" target="_blank">
        Mở tab mới
      </Link>
      <a href="https://example.com/x">Trang ngoài</a>
      <Link href="/">Cùng trang</Link>
      <Link href="/#muc-2">Nhảy trong trang</Link>
    </>,
  );
}

describe('UnsavedChangesGuard', () => {
  describe('beforeunload', () => {
    it('asks the browser to confirm leaving while the form is dirty', () => {
      renderGuard(true);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('lets the page go when the form is clean', () => {
      renderGuard(false);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('stops asking once the form is clean again', () => {
      const { rerender } = renderGuard(true);
      rerender(<UnsavedChangesGuard dirty={false} />);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('links inside the app', () => {
    it('holds the click and asks, while dirty', async () => {
      const user = userEvent.setup();
      renderGuard(true);

      await user.click(screen.getByRole('link', { name: 'Tin tuyển dụng' }));

      expect(
        await screen.findByRole('dialog', { name: 'Rời khỏi trang?' }),
      ).toHaveAccessibleDescription('Các thay đổi chưa lưu sẽ bị mất.');
      expect(reachedThePage).toEqual([]);
      expect(push).not.toHaveBeenCalled();
    });

    it('goes to the link after the person confirms', async () => {
      const user = userEvent.setup();
      renderGuard(true);

      await user.click(screen.getByRole('link', { name: 'Tin tuyển dụng' }));
      await user.click(
        await screen.findByRole('button', { name: 'Rời khỏi trang' }),
      );

      await waitFor(() => expect(push).toHaveBeenCalledWith('/jobs'));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('stays on the page after the person cancels', async () => {
      const user = userEvent.setup();
      renderGuard(true);

      await user.click(screen.getByRole('link', { name: 'Tin tuyển dụng' }));
      await user.click(await screen.findByRole('button', { name: 'Hủy' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(push).not.toHaveBeenCalled();
    });

    it('does nothing while the form is clean', async () => {
      const user = userEvent.setup();
      renderGuard(false);

      await user.click(screen.getByRole('link', { name: 'Tin tuyển dụng' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(reachedThePage).toEqual(['/jobs']);
    });
  });

  describe('clicks it leaves alone', () => {
    it.each([
      ['a new tab', 'Mở tab mới'],
      ['another site', 'Trang ngoài'],
      ['the same page', 'Cùng trang'],
      ['a jump inside the same page', 'Nhảy trong trang'],
    ])('does not hold a link to %s', async (_label, name) => {
      const user = userEvent.setup();
      renderGuard(true);

      await user.click(screen.getByRole('link', { name }));

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not hold a Ctrl-click that opens a new tab', () => {
      renderGuard(true);

      fireEvent.click(screen.getByRole('link', { name: 'Tin tuyển dụng' }), {
        ctrlKey: true,
      });

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
