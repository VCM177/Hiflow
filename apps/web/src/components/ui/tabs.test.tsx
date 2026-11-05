import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function Detail() {
  return (
    <Tabs defaultValue="info">
      <TabsList>
        <TabsTrigger value="info">Thông tin</TabsTrigger>
        <TabsTrigger value="history">Lịch sử</TabsTrigger>
        <TabsTrigger value="offer" disabled>
          Đề nghị
        </TabsTrigger>
      </TabsList>
      <TabsContent value="info">Nội dung thông tin</TabsContent>
      <TabsContent value="history">Nội dung lịch sử</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('shows the default tab panel and marks the active tab', () => {
    render(<Detail />);
    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Nội dung thông tin')).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys and selects with focus', async () => {
    const user = userEvent.setup();
    render(<Detail />);
    screen.getByRole('tab', { name: 'Thông tin' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Lịch sử' })).toHaveFocus();
    expect(screen.getByText('Nội dung lịch sử')).toBeInTheDocument();
  });

  it('skips a disabled tab', async () => {
    const user = userEvent.setup();
    render(<Detail />);
    screen.getByRole('tab', { name: 'Lịch sử' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveFocus();
  });
});
