import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toast } from 'sonner';

import { Toaster } from './sonner';

describe('Toaster', () => {
  it('shows a success toast with its message as text', async () => {
    render(<Toaster />);
    act(() => {
      toast.success('Đã lưu thay đổi');
    });
    expect(await screen.findByText('Đã lưu thay đổi')).toBeInTheDocument();
  });

  it('shows an error toast with its message as text', async () => {
    render(<Toaster />);
    act(() => {
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    });
    expect(
      await screen.findByText('Có lỗi xảy ra, vui lòng thử lại'),
    ).toBeInTheDocument();
  });

  it('exposes its toasts in a live region for screen readers', async () => {
    render(<Toaster />);
    act(() => {
      toast('Đang xử lý');
    });
    await screen.findByText('Đang xử lý');
    const region = document.querySelector('[aria-live]');
    expect(region).not.toBeNull();
  });
});
