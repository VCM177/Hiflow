import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

function IconAction() {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Xóa">
            ×
          </button>
        </TooltipTrigger>
        <TooltipContent>Xóa bản ghi này</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe('Tooltip', () => {
  it('shows its text when the trigger gets keyboard focus', async () => {
    const user = userEvent.setup();
    render(<IconAction />);
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Xóa bản ghi này',
    );
  });

  it('keeps the icon-only trigger named by aria-label, not only by the tooltip', () => {
    render(<IconAction />);
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
  });

  it('hides again when the trigger loses focus', async () => {
    const user = userEvent.setup();
    render(
      <>
        <IconAction />
        <button type="button">Khác</button>
      </>,
    );
    await user.tab();
    await screen.findByRole('tooltip');
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
