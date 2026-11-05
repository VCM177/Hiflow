import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('is reachable by its label and takes typed text', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="email">Email</label>
        <Input id="email" />
      </>,
    );
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com');
  });

  it('cannot be edited when disabled', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="code">Số hiệu</label>
        <Input id="code" disabled />
      </>,
    );
    await user.type(screen.getByLabelText('Số hiệu'), 'X');
    expect(screen.getByLabelText('Số hiệu')).toHaveValue('');
  });

  it('marks an invalid field with aria-invalid and the destructive border', () => {
    render(
      <>
        <label htmlFor="name">Tên hiển thị</label>
        <Input id="name" aria-invalid="true" />
      </>,
    );
    const input = screen.getByLabelText('Tên hiển thị');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('aria-invalid:border-hf-destructive');
  });
});
