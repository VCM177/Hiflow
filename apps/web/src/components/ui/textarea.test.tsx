import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea', () => {
  it('is reachable by its label and accepts multi-line text', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="note">Ghi chú</label>
        <Textarea id="note" />
      </>,
    );
    await user.type(screen.getByLabelText('Ghi chú'), 'dòng 1{Enter}dòng 2');
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('dòng 1\ndòng 2');
  });

  it('cannot be edited when disabled', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="locked">Khóa</label>
        <Textarea id="locked" disabled />
      </>,
    );
    await user.type(screen.getByLabelText('Khóa'), 'x');
    expect(screen.getByLabelText('Khóa')).toHaveValue('');
  });

  it('marks an invalid field with aria-invalid', () => {
    render(
      <>
        <label htmlFor="reason">Lý do</label>
        <Textarea id="reason" aria-invalid="true" />
      </>,
    );
    expect(screen.getByLabelText('Lý do')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
