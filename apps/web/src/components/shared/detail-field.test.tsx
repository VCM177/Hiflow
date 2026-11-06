import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DetailField } from './detail-field';

describe('DetailField', () => {
  it('puts the label and the value in a definition list group', () => {
    const { container } = render(
      <dl>
        <DetailField label="Email">an@example.com</DetailField>
      </dl>,
    );
    expect(screen.getByText('Email').tagName).toBe('DT');
    expect(screen.getByText('an@example.com').tagName).toBe('DD');
    // dl > div > dt/dd: no wrapper in between
    const group = container.querySelector('dl')!.firstElementChild!;
    expect(group.tagName).toBe('DIV');
    expect(group.querySelector('dt')?.parentElement).toBe(group);
  });

  it('shows a dash for no value', () => {
    render(
      <dl>
        <DetailField label="Số điện thoại">{null}</DetailField>
      </dl>,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('takes a class for the group, such as a column span', () => {
    const { container } = render(
      <dl>
        <DetailField label="Lý do" className="sm:col-span-2">
          x
        </DetailField>
      </dl>,
    );
    expect(container.querySelector('dl > div')).toHaveClass('sm:col-span-2');
  });
});
