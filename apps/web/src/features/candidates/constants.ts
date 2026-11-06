import {
  CandidateSource,
  SOURCE_LABEL,
  type Permission,
  PERMISSIONS,
} from '@hiflow/shared-types';

export const SOURCE_OPTIONS = Object.values(CandidateSource).map((source) => ({
  value: source,
  label: SOURCE_LABEL[source],
}));

export function isCandidateSource(value: unknown): value is CandidateSource {
  return (
    typeof value === 'string' &&
    (Object.values(CandidateSource) as string[]).includes(value)
  );
}

/** The columns the API lets the candidate list sort by (`ListCandidatesQueryDto.sortBy`). */
export const CANDIDATE_SORT_KEYS = [
  'fullName',
  'email',
  'source',
  'createdAt',
] as const;

const P = PERMISSIONS.candidate;

export const CANDIDATE_PERMISSION: Record<
  'create' | 'update' | 'cv' | 'note' | 'anonymize',
  Permission
> = {
  create: P.create,
  update: P.update,
  cv: P.cvManage,
  note: P.noteCreate,
  anonymize: P.anonymize,
};

/** The text the API returns for a candidate whose data was erased differs by field; this is the badge. */
export const ANONYMIZED_LABEL = 'Đã ẩn danh';
