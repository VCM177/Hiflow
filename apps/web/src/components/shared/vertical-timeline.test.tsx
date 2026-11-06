import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VerticalTimeline, type TimelineItem } from './vertical-timeline';

const ITEMS: TimelineItem[] = [
  {
    id: 'h2',
    title: 'Chuyển sang Phỏng vấn',
    at: '2026-03-02T03:30:00.000Z',
    actor: 'Trần Thị B',
    note: 'Đạt vòng sàng lọc',
  },
  { id: 'h1', title: 'Nộp hồ sơ', at: '2026-03-01T01:00:00.000Z' },
];

describe('VerticalTimeline', () => {
  it('lists the entries in the order given, named for screen readers', () => {
    render(<VerticalTimeline items={ITEMS} label="Lịch sử trạng thái" />);
    const list = screen.getByRole('list', { name: 'Lịch sử trạng thái' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Chuyển sang Phỏng vấn');
    expect(entries[1]).toHaveTextContent('Nộp hồ sơ');
  });

  it('shows the time in Vietnam time and who did it', () => {
    render(<VerticalTimeline items={ITEMS} />);
    // 03:30 UTC is 10:30 in Vietnam. The <time> sits in the line that also names the actor.
    const time = screen.getByText('02/03/2026 10:30');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-03-02T03:30:00.000Z');
    expect(time.parentElement).toHaveTextContent(
      '02/03/2026 10:30 · Trần Thị B',
    );
  });

  it('shows the note, and leaves out the actor and note when missing', () => {
    render(<VerticalTimeline items={ITEMS} />);
    expect(screen.getByText('Đạt vòng sàng lọc')).toBeInTheDocument();
    // 01:00 UTC is 08:00 in Vietnam. No actor: no separator either.
    const time = screen.getByText('01/03/2026 08:00');
    expect(time.parentElement?.textContent).toBe('01/03/2026 08:00');
  });

  it('says so when there is no history', () => {
    render(<VerticalTimeline items={[]} emptyLabel="Chưa có hoạt động." />);
    expect(screen.getByText('Chưa có hoạt động.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
