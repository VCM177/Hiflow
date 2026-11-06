'use client';

import * as React from 'react';
import type { Permission } from '@hiflow/shared-types';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSession } from '@/providers/session-provider';

/**
 * Applies the "hide or disable" rule (business flow 1.4) to one control.
 *   - The role never holds `permission`: the control is not rendered.
 *   - The role holds it but the record's state locks the action (`disabledReason` given):
 *     the control stays visible, disabled, with the reason in a tooltip. The reason is
 *     also set as the control's description, so it is not only a hover hint.
 *   - Otherwise the control is rendered as is.
 * The API is still the real gate; this only keeps the screen honest.
 */
export function PermissionGate({
  permission,
  disabledReason,
  children,
}: {
  permission: Permission;
  /** Why the action is locked for this record. Leave undefined when it is available. */
  disabledReason?: string;
  /** One control that accepts `disabled` (a Button). */
  children: React.ReactElement<{ disabled?: boolean }>;
}) {
  const { can } = useSession();
  const reasonId = React.useId();

  if (!can(permission)) return null;
  if (!disabledReason) return children;

  // A disabled button gets no pointer or focus events, so the tooltip hangs on a wrapper
  // that can be focused.
  return (
    <>
      <span id={reasonId} className="sr-only">
        {disabledReason}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex"
            aria-describedby={reasonId}
          >
            {React.cloneElement(children, { disabled: true })}
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    </>
  );
}
