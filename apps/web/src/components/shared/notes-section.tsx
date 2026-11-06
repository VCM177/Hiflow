'use client';

import * as React from 'react';

import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { describeApiError } from '@/lib/api/describe-error';

interface State {
  editing: boolean;
  draft: string;
  pending: boolean;
  error: string | null;
}

type Action =
  | { type: 'edit-started'; draft: string }
  | { type: 'draft-changed'; draft: string }
  | { type: 'save-started' }
  | { type: 'save-failed'; message: string }
  | { type: 'closed' };

const IDLE: State = { editing: false, draft: '', pending: false, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'edit-started':
      return {
        editing: true,
        draft: action.draft,
        pending: false,
        error: null,
      };
    case 'draft-changed':
      return { ...state, draft: action.draft };
    case 'save-started':
      return { ...state, pending: true, error: null };
    case 'save-failed':
      return { ...state, pending: false, error: action.message };
    case 'closed':
      return IDLE;
  }
}

/**
 * A free-text note on a record. It is saved as a whole (a PUT): the text replaces the old
 * note, and an empty text deletes it, so `onSave` gets `null` for "no note". Failures stay
 * beside the buttons with the text kept, so nothing typed is lost.
 */
export function NotesSection({
  title,
  value,
  canEdit,
  onSave,
  emptyText = 'Chưa có ghi chú.',
  maxLength,
}: {
  title: string;
  /** The saved note, or null when there is none. */
  value: string | null;
  /** Whether the person may change the note. Hide the editing controls from those who may not. */
  canEdit: boolean;
  onSave: (value: string | null) => Promise<unknown>;
  emptyText?: string;
  maxLength?: number;
}) {
  const [state, dispatch] = React.useReducer(reducer, IDLE);
  const fieldId = React.useId();
  const hintId = React.useId();
  const errorId = React.useId();

  async function save() {
    const next = state.draft.trim() === '' ? null : state.draft.trim();
    // Nothing changed, or there was no note and none was written: no request.
    if (next === value) {
      dispatch({ type: 'closed' });
      return;
    }
    dispatch({ type: 'save-started' });
    try {
      await onSave(next);
      dispatch({ type: 'closed' });
    } catch (error) {
      dispatch({
        type: 'save-failed',
        message: describeApiError(error).message,
      });
    }
  }

  const actions =
    canEdit && !state.editing ? (
      <Button
        onClick={() => dispatch({ type: 'edit-started', draft: value ?? '' })}
      >
        {value === null ? 'Thêm ghi chú' : 'Sửa ghi chú'}
      </Button>
    ) : undefined;

  return (
    <SectionCard title={title} actions={actions}>
      {state.editing ? (
        <div className="flex flex-col gap-3">
          <label htmlFor={fieldId} className="sr-only">
            {title}
          </label>
          <Textarea
            id={fieldId}
            value={state.draft}
            maxLength={maxLength}
            disabled={state.pending}
            aria-describedby={state.error ? `${hintId} ${errorId}` : hintId}
            onChange={(event) =>
              dispatch({ type: 'draft-changed', draft: event.target.value })
            }
          />
          <p id={hintId} className="text-xs text-hf-text-muted">
            Để trống rồi lưu sẽ xóa ghi chú.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {state.error && (
              <p
                id={errorId}
                role="alert"
                className="text-sm text-hf-destructive-text sm:mr-auto"
              >
                {state.error}
              </p>
            )}
            <Button
              disabled={state.pending}
              onClick={() => dispatch({ type: 'closed' })}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              loading={state.pending}
              onClick={() => void save()}
            >
              Lưu ghi chú
            </Button>
          </div>
        </div>
      ) : value === null ? (
        <p className="text-sm text-hf-text-muted">{emptyText}</p>
      ) : (
        <p className="text-sm break-words whitespace-pre-line text-hf-text-body">
          {value}
        </p>
      )}
    </SectionCard>
  );
}
