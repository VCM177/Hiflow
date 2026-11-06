'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { RHFFileField } from '@/components/shared/form/rhf-file-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useCountdown } from '@/hooks/use-countdown';
import { apiRequest } from '@/lib/api/client';

import { describeApplicationError } from './application-error';
import {
  applicationSchema,
  buildApplicationBody,
  type ApplicationInput,
  type ApplicationOutput,
} from './application-schema';
import { CONSENT_LABEL, CV_HINT } from './constants';
import { TurnstileWidget } from './turnstile-widget';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ApplicationForm({
  jobId,
  thanksPath,
}: {
  jobId: string;
  thanksPath: string;
}) {
  const router = useRouter();
  const { secondsLeft, start } = useCountdown();
  const [token, setToken] = React.useState<string | null>(null);
  const [resetSignal, setResetSignal] = React.useState(0);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [closed, setClosed] = React.useState(false);

  const { control, handleSubmit, setError, formState } = useForm<
    ApplicationInput,
    unknown,
    ApplicationOutput
  >({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      cv: null,
      consent: false,
    },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: ApplicationOutput) {
    setFailure(null);
    if (SITE_KEY && !token) {
      setFailure('Vui lòng hoàn tất bước xác minh chống spam.');
      return;
    }
    try {
      await apiRequest('POST', `/public/jobs/${jobId}/applications`, {
        body: buildApplicationBody(values, token),
      });
      router.push(thanksPath);
    } catch (error) {
      const result = describeApplicationError(error);
      if (result.kind === 'field') {
        setError(
          result.field,
          { type: 'server', message: result.message },
          { shouldFocus: true },
        );
      } else if (result.kind === 'wait') {
        setFailure(result.message);
        if (result.retryAfter) start(result.retryAfter);
      } else if (result.kind === 'closed') {
        setClosed(true);
      } else {
        setFailure(result.message);
      }
      // A captcha token works once.
      setToken(null);
      setResetSignal((value) => value + 1);
    }
  }

  if (closed) {
    return (
      <p role="alert" className="text-sm text-hf-text-body">
        Tin này vừa ngừng nhận hồ sơ. Bạn có thể xem các tin đang tuyển khác.
      </p>
    );
  }

  const waiting = secondsLeft > 0;
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <RHFTextField
        control={control}
        name="fullName"
        label="Họ và tên"
        required
        inputProps={{ autoComplete: 'name' }}
      />
      <RHFTextField
        control={control}
        name="email"
        label="Email"
        required
        inputProps={{ type: 'email', autoComplete: 'email' }}
      />
      <RHFTextField
        control={control}
        name="phone"
        label="Số điện thoại"
        required
        inputProps={{ type: 'tel', autoComplete: 'tel' }}
      />
      <RHFFileField
        control={control}
        name="cv"
        label="CV"
        hint={CV_HINT}
        required
        accept=".pdf,.docx"
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id="application-consent"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-required="true"
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={
                  errors.consent ? 'application-consent-error' : undefined
                }
              />
            )}
          />
          <label
            htmlFor="application-consent"
            className="text-sm text-hf-text-body"
          >
            {CONSENT_LABEL}
          </label>
        </div>
        {errors.consent && (
          <p
            id="application-consent-error"
            className="flex items-center gap-1 text-sm text-hf-destructive-text"
          >
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            {errors.consent.message}
          </p>
        )}
      </div>

      {SITE_KEY && (
        <TurnstileWidget
          siteKey={SITE_KEY}
          onToken={setToken}
          resetSignal={resetSignal}
        />
      )}

      {failure && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-hf-destructive-text"
        >
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {failure}
          {waiting && ` Thử lại sau ${secondsLeft} giây.`}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || waiting}>
        {isSubmitting && <Spinner />}
        Gửi hồ sơ
      </Button>
    </form>
  );
}
