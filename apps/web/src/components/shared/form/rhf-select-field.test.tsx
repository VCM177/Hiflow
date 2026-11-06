import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormHarness } from '@/test/form-harness';

import { RHFSelectField } from './rhf-select-field';

// jsdom lacks these; Radix calls them while opening and moving through options.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

type Values = { departmentId: string };
const schema = z.object({
  departmentId: z.string().min(1, { error: 'Vui lòng chọn phòng ban.' }),
});
const OPTIONS = [
  { value: 'd1', label: 'Kỹ thuật' },
  { value: 'd2', label: 'Nhân sự' },
];

function setup(departmentId = '') {
  const onSubmit = vi.fn();
  render(
    <FormHarness<Values>
      schema={schema}
      defaultValues={{ departmentId }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <RHFSelectField
          control={form.control}
          name="departmentId"
          label="Phòng ban"
          required
          selectProps={{ options: OPTIONS, placeholder: 'Chọn phòng ban' }}
        />
      )}
    </FormHarness>,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('RHFSelectField', () => {
  it('is a combobox named by its label, with the placeholder until a choice is made', () => {
    setup();
    expect(
      screen.getByRole('combobox', { name: /Phòng ban/ }),
    ).toHaveTextContent('Chọn phòng ban');
  });

  it('shows the label of the option the form already holds', () => {
    setup('d2');
    expect(
      screen.getByRole('combobox', { name: /Phòng ban/ }),
    ).toHaveTextContent('Nhân sự');
  });

  it('sends the value of the chosen option, not its label', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('combobox', { name: /Phòng ban/ }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: 'Kỹ thuật' }));
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ departmentId: 'd1' });
  });

  it('shows the error and does not submit when nothing is chosen', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(
      await screen.findByText('Vui lòng chọn phòng ban.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Phòng ban/ })).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
