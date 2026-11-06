import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { PageSizeSelector } from './page-size-selector';

// jsdom lacks these; Radix calls them while opening and moving through options.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe('PageSizeSelector', () => {
  it('is labelled and shows the current size', () => {
    render(<PageSizeSelector value={20} onChange={() => {}} />);
    const trigger = screen.getByRole('combobox', { name: 'Số dòng mỗi trang' });
    expect(trigger).toHaveTextContent('20');
  });

  it('offers the standard sizes and reports the chosen one as a number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PageSizeSelector value={10} onChange={onChange} />);

    await user.click(
      screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }),
    );
    const listbox = await screen.findByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '20', '50', '100']);

    await user.click(within(listbox).getByRole('option', { name: '50' }));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('lists a size from the URL that is not a standard one', async () => {
    const user = userEvent.setup();
    render(<PageSizeSelector value={15} onChange={() => {}} />);

    const trigger = screen.getByRole('combobox', { name: 'Số dòng mỗi trang' });
    expect(trigger).toHaveTextContent('15');

    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '15', '20', '50', '100']);
  });
});
