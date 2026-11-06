import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormHarness } from '@/test/form-harness';

import { RHFTextField } from './rhf-text-field';

type Values = { name: string };
const schema = z.object({
  name: z.string().trim().min(1, { error: 'Vui lòng nhập tên.' }),
});

function setup(defaultName = '') {
  const onSubmit = vi.fn();
  render(
    <FormHarness<Values>
      schema={schema}
      defaultValues={{ name: defaultName }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <>
          <RHFTextField
            control={form.control}
            name="name"
            label="Tên phòng ban"
            required
            hint="Tối đa 100 ký tự"
            inputProps={{ placeholder: 'Kỹ thuật', maxLength: 100 }}
          />
          <button
            type="button"
            onClick={() =>
              form.setError('name', {
                type: 'server',
                message: 'Tên đã tồn tại',
              })
            }
          >
            Giả lập lỗi máy chủ
          </button>
        </>
      )}
    </FormHarness>,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('RHFTextField', () => {
  it('shows the label, the hint and the native attributes it was given', () => {
    setup();
    const input = screen.getByLabelText(/Tên phòng ban/);
    expect(input).toHaveAttribute('placeholder', 'Kỹ thuật');
    expect(input).toHaveAttribute('maxlength', '100');
    expect(input).toHaveAccessibleDescription('Tối đa 100 ký tự');
  });

  it('starts from the form value and sends what the person typed', async () => {
    const { user, onSubmit } = setup('Kỹ thuật');
    const input = screen.getByLabelText(/Tên phòng ban/);
    expect(input).toHaveValue('Kỹ thuật');

    await user.clear(input);
    await user.type(input, 'Nhân sự');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: 'Nhân sự' });
  });

  it("shows Zod's message on the field and does not submit", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    const input = await screen.findByLabelText(/Tên phòng ban/);
    await waitFor(() => expect(input).toBeInvalid());
    expect(input).toHaveAccessibleDescription(
      'Tối đa 100 ký tự Vui lòng nhập tên.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the API's message on the same field", async () => {
    const { user } = setup('Kỹ thuật');

    await user.click(
      screen.getByRole('button', { name: 'Giả lập lỗi máy chủ' }),
    );

    expect(await screen.findByText('Tên đã tồn tại')).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên phòng ban/)).toBeInvalid();
  });

  it('clears the error once the value is valid again', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Gửi' }));
    await screen.findByText('Vui lòng nhập tên.');

    await user.type(screen.getByLabelText(/Tên phòng ban/), 'A');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() =>
      expect(screen.queryByText('Vui lòng nhập tên.')).toBeNull(),
    );
  });
});
