'use client';

import * as React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

import type { Overview } from './dashboard-api';
import { funnelRows } from './funnel';

const NUMBER = new Intl.NumberFormat('vi-VN');

/**
 * The recruitment funnel: how many applications ever reached each stage. Ordered stages of
 * one measure, so one hue and bars from a shared baseline, longest first; the value sits at
 * the tip of each bar and a tooltip repeats it with the share of the first stage. A table
 * view gives the same figures to anyone who prefers or needs numbers.
 */
export function FunnelChart({ funnel }: { funnel: Overview['funnel'] }) {
  const [asTable, setAsTable] = React.useState(false);
  const rows = funnelRows(funnel);
  const total = rows[0]?.count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAsTable((value) => !value)}
        >
          {asTable ? 'Xem dạng biểu đồ' : 'Xem dạng bảng'}
        </Button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">Phễu tuyển dụng</caption>
          <thead>
            <tr className="text-left text-xs text-hf-text-muted">
              <th scope="col" className="pb-2 font-medium">
                Bậc
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Số hồ sơ
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                So với bậc đầu
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stage} className="border-t border-hf-border">
                <th
                  scope="row"
                  className="py-2 text-left font-normal text-hf-text-body"
                >
                  {row.label}
                </th>
                <td className="py-2 text-right text-hf-text-heading tabular-nums">
                  {NUMBER.format(row.count)}
                </td>
                <td className="py-2 text-right text-hf-text-body tabular-nums">
                  {row.percentOfFirst === null ? '—' : `${row.percentOfFirst}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : total === 0 ? (
        <p className="py-6 text-center text-sm text-hf-text-muted">
          Chưa có hồ sơ nào trong kỳ này.
        </p>
      ) : (
        <ul aria-label="Phễu tuyển dụng" className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.stage}
              className="grid grid-cols-[6rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]"
            >
              <span className="text-sm text-hf-text-body">{row.label}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    tabIndex={0}
                    role="img"
                    aria-label={`${row.label}: ${NUMBER.format(row.count)} hồ sơ${row.percentOfFirst === null ? '' : `, ${row.percentOfFirst}% so với bậc đầu`}`}
                    className="flex items-center gap-2 rounded-hf-badge outline-none focus-visible:ring-2 focus-visible:ring-hf-ring"
                  >
                    {/* 24px at most, square at the baseline, 4px rounded at the data end. */}
                    <div
                      className="h-5 min-w-0.5 rounded-r-hf-badge bg-hf-primary"
                      style={{
                        width: `${row.width}%`,
                        maxWidth: 'calc(100% - 3.5rem)',
                      }}
                    />
                    <span className="text-sm font-medium text-hf-text-heading tabular-nums">
                      {NUMBER.format(row.count)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {row.label}: {NUMBER.format(row.count)} hồ sơ
                  {row.percentOfFirst !== null &&
                    ` (${row.percentOfFirst}% so với bậc đầu)`}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
