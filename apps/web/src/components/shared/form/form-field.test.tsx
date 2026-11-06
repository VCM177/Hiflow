import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

import { FormField } from './form-field';

function renderField(
  props: Partial<React.ComponentProps<typeof FormField>> = {},
) {
  render(
    <FormField label="Tên phòng ban" {...props}>
      {(control) => <Input {...control} />}
    </FormField>,
  );
}

describe('FormField', () => {
  it('puts the label above the control and ties them together', () => {
    renderField();
    expect(screen.getByLabelText('Tên phòng ban')).toBeInstanceOf(
      HTMLInputElement,
    );
  });

  it('marks a required field visually and for screen readers', () => {
    renderField({ required: true });
    const input = screen.getByLabelText(/Tên phòng ban/);
    expect(input).toHaveAttribute('aria-required', 'true');
    // The asterisk is decoration; the attribute carries the meaning.
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('describes the control with its hint', () => {
    renderField({ hint: 'Tối đa 100 ký tự' });
    expect(screen.getByLabelText('Tên phòng ban')).toHaveAccessibleDescription(
      'Tối đa 100 ký tự',
    );
  });

  it('shows an error as text, flags the control invalid and describes it', () => {
    renderField({ error: 'Tên đã tồn tại' });
    const input = screen.getByLabelText('Tên phòng ban');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Tên đã tồn tại');
    expect(screen.getByText('Tên đã tồn tại')).toBeInTheDocument();
  });

  it('describes the control with both the hint and the error', () => {
    renderField({ hint: 'Tối đa 100 ký tự', error: 'Quá dài' });
    expect(screen.getByLabelText('Tên phòng ban')).toHaveAccessibleDescription(
      'Tối đa 100 ký tự Quá dài',
    );
  });

  it('is valid and has no description when there is nothing to say', () => {
    renderField();
    const input = screen.getByLabelText('Tên phòng ban');
    expect(input).toBeValid();
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-required');
  });
});
