import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from '@/lib/api/errors';
import { categoryCodeSchema } from '@/lib/validations';

import { RHFTextField } from './form/rhf-text-field';
import { FormDialog } from './form-dialog';

const schema = z.object({
  name: z.string().trim().min(1, { error: 'Vui lòng nhập tên.' }),
  code: categoryCodeSchema,
});
type Values = z.infer<typeof schema>;

function Harness({
  onSubmit,
}: {
  onSubmit: (values: Values) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(true);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '' },
  });
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở lại</button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Thêm phòng ban"
        submitLabel="Thêm phòng ban"
        form={form}
        onSubmit={onSubmit}
      >
        <RHFTextField control={form.control} name="name" label="Tên" required />
        <RHFTextField control={form.control} name="code" label="Mã" required />
      </FormDialog>
    </>
  );
}

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<Harness onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Tên/), 'Kỹ thuật');
  await user.type(screen.getByLabelText(/^Mã/), 'ENG');
}

// The dialog also has a "Thêm phòng ban" title; the submit is the button.
const submitButton = () =>
  screen.getByRole('button', { name: 'Thêm phòng ban' });

describe('FormDialog', () => {
  it('is a dialog named by its title with the fields inside', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Thêm phòng ban' });
    expect(dialog).toContainElement(screen.getByLabelText(/^Tên/));
  });

  it('sends the validated values and closes on success', async () => {
    const { user, onSubmit } = setup();

    await fill(user);
    await user.click(submitButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: 'Kỹ thuật',
      code: 'ENG',
    });
  });

  it('shows field errors and sends nothing while the form is invalid', async () => {
    const { user, onSubmit } = setup();

    await user.click(submitButton());

    expect(await screen.findByText('Vui lòng nhập tên.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the dialog and the typed values when the API refuses, with the message beside the button', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, ['Tên hoặc mã phòng ban đã tồn tại']),
      );
    const { user } = setup(onSubmit);

    await fill(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên hoặc mã phòng ban đã tồn tại',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tên/)).toHaveValue('Kỹ thuật');
    expect(submitButton()).toBeEnabled();
  });

  it('locks the buttons and ignores Esc while the request runs', async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = setup(onSubmit);

    await fill(user);
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes on Hủy and starts clean the next time, without the old values or error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, ['Lỗi cũ']));
    const { user } = setup(onSubmit);
    await fill(user);
    await user.click(submitButton());
    await screen.findByText('Lỗi cũ');

    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Mở lại' }));

    expect(await screen.findByLabelText(/^Tên/)).toHaveValue('');
    expect(screen.queryByText('Lỗi cũ')).toBeNull();
  });
});
