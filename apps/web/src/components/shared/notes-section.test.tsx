import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { NotesSection } from './notes-section';

function setup(props: Partial<React.ComponentProps<typeof NotesSection>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <NotesSection
      title="Ghi chú nội bộ"
      value={null}
      canEdit
      onSave={onSave}
      {...props}
    />,
  );
  return { onSave, user: userEvent.setup() };
}

const editor = () => screen.getByRole('textbox', { name: 'Ghi chú nội bộ' });

describe('NotesSection', () => {
  describe('reading', () => {
    it('shows the note as written, keeping line breaks', () => {
      setup({ value: 'Dòng một\nDòng hai' });
      const note = screen.getByText(/Dòng một/);
      expect(note).toHaveTextContent('Dòng một Dòng hai');
      expect(note.className).toContain('whitespace-pre-line');
    });

    it('says there is no note, and offers to add one', () => {
      setup();
      expect(screen.getByText('Chưa có ghi chú.')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Thêm ghi chú' }),
      ).toBeInTheDocument();
    });

    it('offers to edit an existing note', () => {
      setup({ value: 'Ứng viên tiềm năng' });
      expect(
        screen.getByRole('button', { name: 'Sửa ghi chú' }),
      ).toBeInTheDocument();
    });

    it('shows no editing controls to someone who may not edit', () => {
      setup({ value: 'Ứng viên tiềm năng', canEdit: false });
      expect(screen.getByText('Ứng viên tiềm năng')).toBeInTheDocument();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('saving', () => {
    it('starts the editor with the current note', async () => {
      const { user } = setup({ value: 'Cũ' });
      await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
      expect(editor()).toHaveValue('Cũ');
    });

    it('saves the trimmed text and goes back to reading', async () => {
      const { user, onSave } = setup({ value: 'Cũ' });

      await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
      await user.clear(editor());
      await user.type(editor(), '  Mới  ');
      await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

      await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
      expect(onSave).toHaveBeenCalledWith('Mới');
    });

    it('deletes the note by saving it empty, and says so beforehand', async () => {
      const { user, onSave } = setup({ value: 'Cũ' });

      await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
      expect(editor()).toHaveAccessibleDescription(
        'Để trống rồi lưu sẽ xóa ghi chú.',
      );
      await user.clear(editor());
      await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

      await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
    });

    it('sends nothing when there was no note and none was written', async () => {
      const { user, onSave } = setup();

      await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
      await user.type(editor(), '   ');
      await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('sends nothing when the text did not change', async () => {
      const { user, onSave } = setup({ value: 'Cũ' });

      await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
      await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

      expect(onSave).not.toHaveBeenCalled();
    });

    it('drops the draft on Hủy', async () => {
      const { user, onSave } = setup({ value: 'Cũ' });

      await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
      await user.type(editor(), ' thêm');
      await user.click(screen.getByRole('button', { name: 'Hủy' }));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Cũ')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
      expect(editor()).toHaveValue('Cũ');
    });

    it('limits the text when a length is given', async () => {
      const { user } = setup({ maxLength: 500 });
      await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
      expect(editor()).toHaveAttribute('maxlength', '500');
    });
  });

  describe('when saving fails', () => {
    it('keeps the editor and the typed text, with the API message beside the buttons', async () => {
      const onSave = vi
        .fn()
        .mockRejectedValue(new ApiError(409, ['Hồ sơ đã được ẩn danh']));
      const { user } = setup({ onSave });

      await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
      await user.type(editor(), 'Quan trọng');
      await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Hồ sơ đã được ẩn danh',
      );
      expect(editor()).toHaveValue('Quan trọng');
      expect(editor()).toHaveAccessibleDescription(/Hồ sơ đã được ẩn danh/);
      expect(screen.getByRole('button', { name: 'Lưu ghi chú' })).toBeEnabled();
    });

    it('locks the editor while the request runs', async () => {
      let finish: () => void = () => {};
      const onSave = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const { user } = setup({ onSave });

      await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
      await user.type(editor(), 'x');
      await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

      expect(editor()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Lưu ghi chú' }),
      ).toHaveAttribute('aria-busy', 'true');

      finish();
      await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    });
  });
});
