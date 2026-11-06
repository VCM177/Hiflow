import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

function Harness(
  props: Partial<ConfirmDialogProps> & Pick<ConfirmDialogProps, 'onConfirm'>,
) {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở lại</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xóa phòng ban"
        description="Phòng ban sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa phòng ban"
        {...props}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('states the consequence and names the action instead of "OK"', () => {
    render(<Harness onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Xóa phòng ban' });
    expect(dialog).toHaveAccessibleDescription(
      'Phòng ban sẽ bị xóa vĩnh viễn.',
    );
    expect(
      screen.getByRole('button', { name: 'Xóa phòng ban' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });

  it('runs the action and closes on success', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('closes without running the action on Hủy', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks both buttons while the action runs', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Xóa phòng ban' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Xóa phòng ban' }),
    ).toHaveAttribute('aria-busy', 'true');
    // Esc does not close it mid-flight.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the dialog open and shows the API message beside the confirm button on failure', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, ['Phòng ban đang được sử dụng nên không thể xóa']),
      );
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phòng ban đang được sử dụng nên không thể xóa',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Back to usable so the person can cancel or retry.
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Xóa phòng ban' })).toBeEnabled();
  });

  it('offers a reload when another person already handled the record', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const onConfirm = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, ['Hồ sơ vừa được xử lý bởi người khác']),
      );
    render(<Harness onConfirm={onConfirm} onReload={onReload} />);

    await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));
    await user.click(await screen.findByRole('button', { name: 'Tải lại' }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('does not offer a reload for an ordinary conflict', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn()
      .mockRejectedValue(new ApiError(409, ['Tên đã tồn tại']));
    render(<Harness onConfirm={onConfirm} onReload={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));
    await screen.findByRole('alert');

    expect(screen.queryByRole('button', { name: 'Tải lại' })).toBeNull();
  });

  describe('with a required reason', () => {
    const reason = { label: 'Lý do từ chối' };

    it('does not run the action until a reason is typed', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<Harness onConfirm={onConfirm} reason={reason} />);

      await user.type(screen.getByLabelText('Lý do từ chối'), '   ');
      await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Vui lòng nhập lý do.',
      );
      expect(screen.getByLabelText('Lý do từ chối')).toBeInvalid();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('passes the trimmed reason to the action', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<Harness onConfirm={onConfirm} reason={reason} />);

      await user.type(
        screen.getByLabelText('Lý do từ chối'),
        '  Thiếu kinh nghiệm  ',
      );
      await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith('Thiếu kinh nghiệm'),
      );
    });

    it('clears the reason error as soon as the person types', async () => {
      const user = userEvent.setup();
      render(<Harness onConfirm={vi.fn()} reason={reason} />);

      await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));
      await screen.findByRole('alert');
      await user.type(screen.getByLabelText('Lý do từ chối'), 'a');

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('starts clean each time it opens', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new ApiError(409, ['Lỗi cũ']));
    render(<Harness onConfirm={onConfirm} reason={{ label: 'Lý do' }} />);

    await user.type(screen.getByLabelText('Lý do'), 'đã gõ');
    await user.click(screen.getByRole('button', { name: 'Xóa phòng ban' }));
    await screen.findByText('Lỗi cũ');
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Mở lại' }));

    expect(await screen.findByLabelText('Lý do')).toHaveValue('');
    expect(screen.queryByText('Lỗi cũ')).toBeNull();
  });
});
