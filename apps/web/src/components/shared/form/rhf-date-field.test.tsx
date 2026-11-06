import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormHarness } from '@/test/form-harness';

import { RHFDateField } from './rhf-date-field';

type Values = { startDate: string };
const schema = z.object({
  startDate: z.string().min(1, { error: 'Vui lòng chọn ngày.' }),
});

function setup(startDate = '') {
  const onSubmit = vi.fn();
  render(
    <FormHarness<Values>
      schema={schema}
      defaultValues={{ startDate }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <RHFDateField
          control={form.control}
          name="startDate"
          label="Ngày bắt đầu"
          inputProps={{ min: '2026-01-01' }}
        />
      )}
    </FormHarness>,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('RHFDateField', () => {
  it('is the browser date input and passes min and max through', () => {
    setup();
    const input = screen.getByLabelText('Ngày bắt đầu');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('min', '2026-01-01');
  });

  it('shows the form value as yyyy-MM-dd', () => {
    setup('2026-03-15');
    expect(screen.getByLabelText('Ngày bắt đầu')).toHaveValue('2026-03-15');
  });

  it('sends the chosen date as text', async () => {
    const { user, onSubmit } = setup();

    await user.type(screen.getByLabelText('Ngày bắt đầu'), '2026-04-02');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ startDate: '2026-04-02' });
  });

  it('asks for a date when it is empty', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByText('Vui lòng chọn ngày.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
