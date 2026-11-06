import {
  APPLICATION_STATUS_LABEL,
  ApplicationStatus,
} from '@hiflow/shared-types';

import type { StatusMap } from '@/components/shared/status-badge';

// Colours follow the design guide: in-progress steps primary, screening waiting,
// hired success, rejected destructive, withdrawn neutral.
export const APPLICATION_STATUS_MAP: StatusMap<ApplicationStatus> = {
  [ApplicationStatus.NEW]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.NEW],
    variant: 'primary',
  },
  [ApplicationStatus.SCREENING]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.SCREENING],
    variant: 'warning',
  },
  [ApplicationStatus.INTERVIEW]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.INTERVIEW],
    variant: 'primary',
  },
  [ApplicationStatus.OFFER]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.OFFER],
    variant: 'primary',
  },
  [ApplicationStatus.HIRED]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.HIRED],
    variant: 'success',
  },
  [ApplicationStatus.REJECTED]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.REJECTED],
    variant: 'destructive',
  },
  [ApplicationStatus.WITHDRAWN]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.WITHDRAWN],
    variant: 'neutral',
  },
};
