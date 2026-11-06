import {
  APPLICATION_TRANSITIONS,
  ApplicationStatus,
  InterviewResult,
  OfferStatus,
} from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import {
  APPLICATION_STATUS_MAP,
  INTERVIEW_RESULT_MAP,
  OFFER_STATUS_MAP,
  statusActionsFor,
} from './constants';

describe('APPLICATION_STATUS_MAP', () => {
  it('covers every status with a label', () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(APPLICATION_STATUS_MAP[status].label).toBeTruthy();
    }
  });
});

describe('statusActionsFor', () => {
  const none = { interviews: [] };

  it('never offers Nhận việc: it comes only from an accepted offer', () => {
    for (const status of Object.values(ApplicationStatus)) {
      const targets = statusActionsFor({ status, ...none }).map((a) => a.to);
      expect(targets).not.toContain(ApplicationStatus.HIRED);
    }
  });

  it('offers exactly the transitions of the map (minus Nhận việc)', () => {
    for (const status of Object.values(ApplicationStatus)) {
      const targets = statusActionsFor({ status, ...none }).map((a) => a.to);
      const expected = APPLICATION_TRANSITIONS[status].filter(
        (to) => to !== ApplicationStatus.HIRED,
      );
      expect([...targets].sort()).toEqual([...expected].sort());
    }
  });

  it('puts the advancing step first, then reject and withdraw', () => {
    const kinds = statusActionsFor({
      status: ApplicationStatus.NEW,
      ...none,
    }).map((a) => a.kind);
    expect(kinds).toEqual(['advance', 'reject', 'withdraw']);
  });

  it('offers nothing on a finished application', () => {
    for (const status of [
      ApplicationStatus.HIRED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ]) {
      expect(statusActionsFor({ status, ...none })).toEqual([]);
    }
  });

  it('locks Đề nghị without a passed round, with the reason', () => {
    const offer = (interviews: { result: InterviewResult }[]) =>
      statusActionsFor({
        status: ApplicationStatus.INTERVIEW,
        interviews,
      }).find((a) => a.to === ApplicationStatus.OFFER);
    expect(offer([])?.disabledReason).toContain(
      'ít nhất một vòng phỏng vấn đạt',
    );
    expect(
      offer([{ result: InterviewResult.FAILED }])?.disabledReason,
    ).toBeDefined();
    expect(
      offer([{ result: InterviewResult.PASSED }])?.disabledReason,
    ).toBeUndefined();
  });

  it('locks Đề nghị while a round waits for its result', () => {
    const action = statusActionsFor({
      status: ApplicationStatus.INTERVIEW,
      interviews: [
        { result: InterviewResult.PASSED },
        { result: InterviewResult.PENDING },
      ],
    }).find((a) => a.to === ApplicationStatus.OFFER);
    expect(action?.disabledReason).toContain('chưa có kết quả');
  });
});

describe('maps', () => {
  it('cover every interview result and offer status', () => {
    for (const result of Object.values(InterviewResult)) {
      expect(INTERVIEW_RESULT_MAP[result].label).toBeTruthy();
    }
    for (const status of Object.values(OfferStatus)) {
      expect(OFFER_STATUS_MAP[status].label).toBeTruthy();
    }
  });
});
