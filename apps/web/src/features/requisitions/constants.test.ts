import {
  RequisitionStatus,
  REQUISITION_TRANSITIONS,
} from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import {
  REQUISITION_STATUS_MAP,
  actionsFor,
  isRequisitionStatus,
} from './constants';

describe('requisition constants', () => {
  it('has a label and colour for every status', () => {
    for (const status of Object.values(RequisitionStatus)) {
      expect(REQUISITION_STATUS_MAP[status].label).toBeTruthy();
    }
  });

  it('offers submit, approve and close only where the transition map allows them', () => {
    const allows = (from: RequisitionStatus, to: RequisitionStatus) =>
      REQUISITION_TRANSITIONS[from].includes(to);
    for (const status of Object.values(RequisitionStatus)) {
      const actions = actionsFor(status);
      expect(actions.includes('submit')).toBe(
        allows(status, RequisitionStatus.PENDING_APPROVAL),
      );
      expect(actions.includes('approve')).toBe(
        allows(status, RequisitionStatus.APPROVED),
      );
      expect(actions.includes('reject')).toBe(
        allows(status, RequisitionStatus.REJECTED),
      );
      expect(actions.includes('close')).toBe(
        allows(status, RequisitionStatus.CLOSED),
      );
    }
  });

  it('follows the plan table', () => {
    expect(actionsFor(RequisitionStatus.DRAFT)).toEqual([
      'edit',
      'delete',
      'submit',
    ]);
    expect(actionsFor(RequisitionStatus.REJECTED)).toEqual(['edit', 'submit']);
    expect(actionsFor(RequisitionStatus.APPROVED)).toEqual([
      'createJob',
      'close',
    ]);
    expect(actionsFor(RequisitionStatus.CLOSED)).toEqual([]);
  });

  it('recognises a status value', () => {
    expect(isRequisitionStatus('APPROVED')).toBe(true);
    expect(isRequisitionStatus('x')).toBe(false);
  });
});
