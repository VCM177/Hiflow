import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';

import { IconButton } from './icon-button';

function setup(props: Partial<React.ComponentProps<typeof IconButton>> = {}) {
  const onClick = vi.fn();
  render(
    <TooltipProvider delayDuration={0}>
      <IconButton
        label="Sửa Kỹ thuật"
        icon={Pencil}
        onClick={onClick}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onClick, user: userEvent.setup() };
}

describe('IconButton', () => {
  it('is a button named by its label, with the icon hidden from screen readers', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Sửa Kỹ thuật' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('runs the action on click', async () => {
    const { user, onClick } = setup();
    await user.click(screen.getByRole('button', { name: 'Sửa Kỹ thuật' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the label as a tooltip on keyboard focus', async () => {
    const { user } = setup();
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Sửa Kỹ thuật',
    );
  });

  it('does not run the action when disabled', async () => {
    const { user, onClick } = setup({ disabled: true });
    const button = screen.getByRole('button', { name: 'Sửa Kỹ thuật' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
