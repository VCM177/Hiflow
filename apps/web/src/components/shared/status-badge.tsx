import { Badge, type BadgeProps } from '@/components/ui/badge';

export interface StatusDisplay {
  label: string;
  variant: NonNullable<BadgeProps['variant']>;
}

/** The map a module keeps in its `constants.ts`: every status of the enum, with its label and colour. */
export type StatusMap<TStatus extends string> = Record<TStatus, StatusDisplay>;

/**
 * Renders a status. The label and the colour come from the module's map, so this
 * component never chooses a colour itself and no screen draws its own pill. A status the
 * map does not know (a newer API value) shows as neutral with its raw text rather than
 * breaking the screen.
 */
export function StatusBadge<TStatus extends string>({
  status,
  map,
}: {
  status: TStatus;
  map: StatusMap<TStatus>;
}) {
  const display: StatusDisplay | undefined = map[status];
  return (
    <Badge variant={display?.variant ?? 'neutral'}>
      {display?.label ?? status}
    </Badge>
  );
}
