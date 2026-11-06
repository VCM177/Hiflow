'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * An icon-only action (edit, delete) for a table row or a toolbar. The label is its
 * accessible name and its tooltip, so the icon is never the only way to know what it does.
 * Takes `disabled` like a Button, so `PermissionGate` can lock it.
 */
export function IconButton({
  label,
  icon: Icon,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'children'> & {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
