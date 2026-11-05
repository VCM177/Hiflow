import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

function Confirm({
  preventDismiss = false,
  onConfirm = () => {},
}: {
  preventDismiss?: boolean;
  onConfirm?: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger>Xóa tin</DialogTrigger>
      <DialogContent size="sm" preventDismiss={preventDismiss}>
        <DialogHeader>
          <DialogTitle>Xóa tin tuyển dụng?</DialogTitle>
          <DialogDescription>
            Thao tác này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={onConfirm}>
            Xác nhận xóa
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('opens from its trigger and names itself with its title', async () => {
    const user = userEvent.setup();
    render(<Confirm />);
    await user.click(screen.getByRole('button', { name: 'Xóa tin' }));
    expect(
      screen.getByRole('dialog', { name: 'Xóa tin tuyển dụng?' }),
    ).toBeInTheDocument();
  });

  it('closes with Esc and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Confirm />);
    const trigger = screen.getByRole('button', { name: 'Xóa tin' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it('does not close on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Nền trang</p>
        <Confirm />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Xóa tin' }));
    // Radix blocks pointer events on the page while a modal is open, so a real
    // click cannot reach the page. Send the pointerdown the overlay would receive.
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps focus inside while open (Tab cycles within the dialog)', async () => {
    const user = userEvent.setup();
    render(<Confirm />);
    await user.click(screen.getByRole('button', { name: 'Xóa tin' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('ignores Esc and the close button while preventDismiss is set', async () => {
    const user = userEvent.setup();
    render(<Confirm preventDismiss />);
    await user.click(screen.getByRole('button', { name: 'Xóa tin' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('runs the confirm action from inside the dialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Confirm onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Xóa tin' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
