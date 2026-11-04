import { PERMISSIONS } from '@hiflow/shared-types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Đã bấm {count} lần
    </button>
  );
}

describe('web test tooling', () => {
  it('renders a component and reacts to the keyboard', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const button = screen.getByRole('button', { name: 'Đã bấm 0 lần' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveTextContent('Đã bấm 1 lần');
  });

  it('imports the shared types package', () => {
    expect(PERMISSIONS.job.listView).toBe('job.list.view');
  });
});
