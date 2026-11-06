import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormHarness } from '@/test/form-harness';

import { RHFFileField } from './rhf-file-field';

type Values = { cv: File | null };
const schema = z.object({
  cv: z
    .instanceof(File, { error: 'Vui lòng chọn tệp CV.' })
    .refine((file) => file.name.endsWith('.pdf'), {
      error: 'Chỉ nhận tệp PDF.',
    }),
});

function setup() {
  const onSubmit = vi.fn();
  render(
    <FormHarness<Values>
      schema={schema}
      defaultValues={{ cv: null }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <RHFFileField
          control={form.control}
          name="cv"
          label="CV"
          hint="PDF, tối đa 5 MB"
          accept=".pdf"
        />
      )}
    </FormHarness>,
  );
  return { onSubmit, user: userEvent.setup() };
}

const cv = (name: string) => new File(['x'], name, { type: 'application/pdf' });

describe('RHFFileField', () => {
  it('is a file input that offers only the accepted extensions', () => {
    setup();
    const input = screen.getByLabelText('CV');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.pdf');
  });

  it('puts the chosen file in the form and shows its name', async () => {
    const { user, onSubmit } = setup();

    await user.upload(screen.getByLabelText('CV'), cv('cv-nguyen-van-a.pdf'));
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0]?.[0] as Values;
    expect(sent.cv?.name).toBe('cv-nguyen-van-a.pdf');
    expect(screen.getByLabelText('CV')).toHaveAccessibleDescription(
      /cv-nguyen-van-a\.pdf/,
    );
  });

  it('asks for a file when none is chosen', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(
      await screen.findByText('Vui lòng chọn tệp CV.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('CV')).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reports a file the rules refuse, and keeps the file name and hint readable beside the error', async () => {
    const { onSubmit } = setup();
    // `accept` only steers the picker: choosing "All files" still hands over any file, so
    // the form's own rule must catch it. user-event would drop it by `accept` otherwise.
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(
      screen.getByLabelText('CV'),
      new File(['x'], 'cv.txt', { type: 'text/plain' }),
    );
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByText('Chỉ nhận tệp PDF.')).toBeInTheDocument();
    const description = screen.getByLabelText('CV');
    expect(description).toHaveAccessibleDescription(/cv\.txt/);
    expect(description).toHaveAccessibleDescription(/PDF, tối đa 5 MB/);
    expect(description).toHaveAccessibleDescription(/Chỉ nhận tệp PDF\./);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
