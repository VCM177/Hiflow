import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FileInput } from './file-input';

describe('FileInput', () => {
  it('shows the empty label until a file is chosen, then the file name', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="cv">Hồ sơ (PDF hoặc DOCX)</label>
        <FileInput id="cv" accept=".pdf,.docx" />
      </>,
    );
    expect(screen.getByText('Chưa chọn tệp')).toBeInTheDocument();

    const file = new File(['%PDF-1.4'], 'cv-nguyen-van-a.pdf', {
      type: 'application/pdf',
    });
    await user.upload(screen.getByLabelText('Hồ sơ (PDF hoặc DOCX)'), file);
    expect(screen.getByText('cv-nguyen-van-a.pdf')).toBeInTheDocument();
  });

  it('passes the file to the change handler', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="doc">Tài liệu</label>
        <FileInput id="doc" onChange={onChange} />
      </>,
    );
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Tài liệu'), file);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is described by its hint and is not editable when disabled', () => {
    render(
      <>
        <label htmlFor="locked">Khóa</label>
        <FileInput id="locked" disabled />
      </>,
    );
    const input = screen.getByLabelText('Khóa');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('keeps the file name in its description when the caller adds more', () => {
    render(
      <>
        <label htmlFor="cv2">CV</label>
        <p id="extra">Tối đa 5 MB</p>
        <FileInput id="cv2" aria-describedby="extra" />
      </>,
    );
    expect(screen.getByLabelText('CV')).toHaveAccessibleDescription(
      'Chưa chọn tệp Tối đa 5 MB',
    );
  });
});
