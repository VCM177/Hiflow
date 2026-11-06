'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { describeApiError } from '@/lib/api/describe-error';
import { requiredReasonSchema } from '@/lib/validations';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, including anything that cannot be undone. */
  description: string;
  /** The action in words ("Xóa phòng ban"), never "OK". */
  confirmLabel: string;
  /** Asks for a reason the API requires (reject, fail). The reason is trimmed and never empty. */
  reason?: { label: string; placeholder?: string };
  /**
   * Runs the action. A rejected promise keeps the dialog open and shows the error beside
   * the confirm button; a resolved one closes it.
   */
  onConfirm: (reason: string | undefined) => Promise<unknown> | void;
  /** Shown as "Tải lại" when the API says another person already handled the record. */
  onReload?: () => void;
}

interface State {
  reason: string;
  reasonError: string | null;
  pending: boolean;
  error: { message: string; reload: boolean } | null;
}

type Action =
  | { type: 'reset' }
  | { type: 'reason-changed'; value: string }
  | { type: 'reason-invalid'; message: string }
  | { type: 'submit-started' }
  | { type: 'submit-failed'; message: string; reload: boolean };

const INITIAL: State = {
  reason: '',
  reasonError: null,
  pending: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return INITIAL;
    case 'reason-changed':
      return { ...state, reason: action.value, reasonError: null };
    case 'reason-invalid':
      return { ...state, reasonError: action.message };
    case 'submit-started':
      return { ...state, pending: true, error: null };
    case 'submit-failed':
      return {
        ...state,
        pending: false,
        error: { message: action.message, reload: action.reload },
      };
  }
}

/**
 * Required before any destructive or irreversible action (delete, reject, close, cancel).
 * Errors from the action appear beside the confirm button, per the dialog rule in the
 * design guide; success closes the dialog and the caller shows the toast.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  reason,
  onConfirm,
  onReload,
}: ConfirmDialogProps) {
  const [state, dispatch] = React.useReducer(reducer, INITIAL);
  const reasonId = React.useId();
  const errorId = React.useId();

  // Each opening starts clean. Resetting on open (not on close) keeps the text on screen
  // during the closing animation.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) dispatch({ type: 'reset' });
  }

  async function handleConfirm() {
    let value: string | undefined;
    if (reason) {
      const parsed = requiredReasonSchema.safeParse(state.reason);
      if (!parsed.success) {
        dispatch({
          type: 'reason-invalid',
          message: parsed.error.issues[0]?.message ?? 'Vui lòng nhập lý do.',
        });
        return;
      }
      value = parsed.data;
    }
    dispatch({ type: 'submit-started' });
    try {
      await onConfirm(value);
      onOpenChange(false);
    } catch (error) {
      const shown = describeApiError(error);
      dispatch({
        type: 'submit-failed',
        message: shown.message,
        reload: shown.kind === 'inline' && shown.reload,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" preventDismiss={state.pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {reason && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={reasonId}
              className="text-sm font-medium text-hf-text-heading"
            >
              {reason.label}
            </label>
            <Textarea
              id={reasonId}
              value={state.reason}
              placeholder={reason.placeholder}
              disabled={state.pending}
              aria-invalid={state.reasonError ? true : undefined}
              aria-describedby={state.reasonError ? errorId : undefined}
              onChange={(event) =>
                dispatch({ type: 'reason-changed', value: event.target.value })
              }
            />
            {state.reasonError && (
              <p
                id={errorId}
                role="alert"
                className="text-sm text-hf-destructive-text"
              >
                {state.reasonError}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="items-center">
          {state.error && (
            <p
              role="alert"
              className="text-sm text-hf-destructive-text sm:mr-auto"
            >
              {state.error.message}
              {state.error.reload && onReload && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onReload}
                    className="font-medium underline focus-visible:ring-2 focus-visible:ring-hf-ring"
                  >
                    Tải lại
                  </button>
                </>
              )}
            </p>
          )}
          <Button
            variant="secondary"
            disabled={state.pending}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            loading={state.pending}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
