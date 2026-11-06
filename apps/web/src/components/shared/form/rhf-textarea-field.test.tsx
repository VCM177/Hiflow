import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { requiredReasonSchema } from '@/lib/validations';
import { FormHarness } from '@/test/form-harness';

import { RHFTextareaField } from './rhf-textarea-field';

type Values = { reason: string };
const schema = z.object({ reason: requiredReasonSchema });

function setup() {
  const onSubmit = vi.fn();
  render(
    <FormHarness<Values>
      schema={schema}
      defaultValues={{ reason: '' }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <RHFTextareaField
          control={form.control}
          name="reason"
          label="Lý do"
          required
          inputProps={{ placeholder: 'Nêu lý do' }}
        />
      )}
    </FormHarness>,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('RHFTextareaField', () => {
  it('is a multi-line field named by its label', () => {
    setup();
    const field = screen.getByLabelText(/Lý do/);
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('placeholder', 'Nêu lý do');
  });

  it('sends the typed text', async () => {
    const { user, onSubmit } = setup();

    await user.type(screen.getByLabelText(/Lý do/), 'Thiếu kinh nghiệm');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      reason: 'Thiếu kinh nghiệm',
    });
  });

  it('rejects blank text with the shared reason message', async () => {
    const { user, onSubmit } = setup();

    await user.type(screen.getByLabelText(/Lý do/), '   ');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByText('Vui lòng nhập lý do.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Lý do/)).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
