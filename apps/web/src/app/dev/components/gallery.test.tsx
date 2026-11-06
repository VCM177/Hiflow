import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ComponentGallery } from './gallery';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom lacks these; Radix calls them while opening the department select.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe('ComponentGallery', () => {
  it('shows every status through its map and the history in order', () => {
    render(<ComponentGallery />);
    for (const label of [
      'Chờ xử lý',
      'Đang thực hiện',
      'Hoàn thành',
      'Không đạt',
      'Đã đóng',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('list', { name: 'Lịch sử trạng thái' }),
    ).toBeInTheDocument();
  });

  it('asks for every required field when sent empty', async () => {
    const user = userEvent.setup();
    render(<ComponentGallery />);

    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    for (const message of [
      'Vui lòng nhập tên.',
      'Vui lòng chọn phòng ban.',
      'Vui lòng chọn ngày.',
      'Vui lòng chọn tệp CV.',
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
  });

  it('refuses a CV of the wrong type with the shared rule', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ComponentGallery />);

    await user.upload(
      screen.getByLabelText(/^CV/),
      new File(['x'], 'cv.txt', { type: 'text/plain' }),
    );
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(
      await screen.findByText('Chỉ chấp nhận tệp PDF hoặc DOCX.'),
    ).toBeInTheDocument();
  });

  it("puts the API's message on the name field", async () => {
    const user = userEvent.setup();
    render(<ComponentGallery />);

    await user.click(
      screen.getByRole('button', { name: /Giả lập lỗi 400 của API/ }),
    );

    expect(
      await screen.findByText('Tên này không được chấp nhận.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tên/)).toBeInvalid();
  });

  it('asks before leaving once the form has been edited', async () => {
    const user = userEvent.setup();
    render(<ComponentGallery />);

    await user.type(screen.getByLabelText(/^Tên/), 'Kỹ thuật');
    await user.click(screen.getByRole('link', { name: 'Xem token' }));

    expect(
      await screen.findByRole('dialog', { name: 'Rời khỏi trang?' }),
    ).toBeInTheDocument();
  });

  it('lets the person leave while the form is untouched', async () => {
    const user = userEvent.setup();
    render(<ComponentGallery />);
    // jsdom cannot navigate; the click must simply not be held by a dialog.
    document.addEventListener('click', (e) => e.preventDefault(), {
      once: true,
    });

    await user.click(screen.getByRole('link', { name: 'Xem token' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a failed note save beside the buttons and keeps the text', async () => {
    const user = userEvent.setup();
    render(<ComponentGallery />);

    await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
    const editor = screen.getByRole('textbox', { name: 'Ghi chú nội bộ' });
    await user.clear(editor);
    await user.type(editor, 'có lỗi');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hồ sơ đã được ẩn danh nên không thể sửa ghi chú.',
    );
    expect(editor).toHaveValue('có lỗi');
  });
});
