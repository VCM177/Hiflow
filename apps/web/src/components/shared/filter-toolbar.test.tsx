import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FilterToolbar, type FilterToolbarProps } from './filter-toolbar';

function setup(props: Partial<FilterToolbarProps> = {}) {
  const onSearchChange = vi.fn();
  const onReset = vi.fn();
  render(
    <FilterToolbar
      search=""
      onSearchChange={onSearchChange}
      hasActiveFilters={false}
      onReset={onReset}
      {...props}
    />,
  );
  return { onSearchChange, onReset };
}

const box = () => screen.getByRole('searchbox', { name: 'Tìm kiếm' });
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

// The debounce tests use pure fake timers so "299 ms: nothing yet, 300 ms: reported" is
// exact. Testing Library does not see vitest's fake timers, so these tests type with
// fireEvent (synchronous) instead of userEvent, which would wait on a faked timeout.
describe('FilterToolbar', () => {
  describe('search', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts from the term in the URL without reporting it again', () => {
      const { onSearchChange } = setup({ search: 'kỹ thuật' });
      expect(box()).toHaveValue('kỹ thuật');
      wait(1000);
      expect(onSearchChange).not.toHaveBeenCalled();
    });

    it('waits 300 ms after the last key, then reports the whole term once', () => {
      const { onSearchChange } = setup();

      type('nh');
      wait(200);
      type('nhân');
      // 200 ms after the first key but only 299 after the last: still nothing.
      wait(299);
      expect(onSearchChange).not.toHaveBeenCalled();

      wait(1);
      expect(onSearchChange).toHaveBeenCalledTimes(1);
      expect(onSearchChange).toHaveBeenCalledWith('nhân');
    });

    it('applies an emptied box at once', () => {
      const { onSearchChange } = setup({ search: 'abc' });

      type('');

      expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('limits the term to what the API accepts', () => {
      setup();
      expect(box()).toHaveAttribute('maxlength', '100');
    });
  });

  describe('clearing filters', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows no clear button while nothing is filtered', () => {
      setup();
      expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).toBeNull();
    });

    it('clears the box and tells the caller to reset', () => {
      const { onReset, onSearchChange } = setup({
        search: 'abc',
        hasActiveFilters: true,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));

      expect(onReset).toHaveBeenCalledTimes(1);
      expect(box()).toHaveValue('');
      // The caller's reset already clears the term; the box must not report it a second time.
      wait(1000);
      expect(onSearchChange).not.toHaveBeenCalled();
    });
  });

  it('puts light filters on the same line', () => {
    setup({ children: <button>Trạng thái</button> });
    expect(screen.getByRole('search')).toContainElement(
      screen.getByRole('button', { name: 'Trạng thái' }),
    );
  });

  describe('advanced filters', () => {
    it('has no dialog button unless advanced filters are given', () => {
      setup();
      expect(
        screen.queryByRole('button', { name: 'Bộ lọc nâng cao' }),
      ).toBeNull();
    });

    it('opens the complex filters in a dialog and closes it on Xong', async () => {
      const user = userEvent.setup();
      setup({
        advanced: {
          title: 'Bộ lọc nâng cao',
          children: (
            <label>
              Từ ngày <input type="date" />
            </label>
          ),
        },
      });

      await user.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'Bộ lọc nâng cao',
      });
      expect(dialog).toContainElement(screen.getByLabelText('Từ ngày'));

      await user.click(screen.getByRole('button', { name: 'Xong' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
