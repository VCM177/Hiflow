'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { AuthUser } from '@hiflow/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api/client';
import { landingPathFor } from '@/lib/auth/landing';
import { describeLoginError } from '@/lib/auth/login-error';
import { sessionQueryKey } from '@/lib/auth/session';
import { useCountdown } from '@/hooks/use-countdown';

import { loginSchema, type LoginInput, type LoginOutput } from './login-schema';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="flex items-center gap-1 text-sm text-hf-destructive-text"
    >
      <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
      {message}
    </p>
  );
}

/** `next` is the page the visitor asked for, already checked to be inside the app. */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { secondsLeft, start } = useCountdown();
  const [failure, setFailure] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginOutput) {
    setFailure(null);
    try {
      const { user } = await apiRequest<{ user: AuthUser }>(
        'POST',
        '/auth/login',
        { body: values },
      );
      queryClient.setQueryData(sessionQueryKey, user);
      router.replace(next ?? landingPathFor(user.permissions));
    } catch (error) {
      const { message, retryAfter } = describeLoginError(error);
      setFailure(message);
      if (retryAfter) start(retryAfter);
      // The email stays; the password is typed again.
      setValue('password', '');
      setFocus('password');
    }
  }

  const waiting = secondsLeft > 0;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-email"
          className="text-sm font-medium text-hf-text-heading"
        >
          Email
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        <FieldError id="login-email-error" message={errors.email?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-password"
          className="text-sm font-medium text-hf-text-heading"
        >
          Mật khẩu
        </label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={
            errors.password ? 'login-password-error' : undefined
          }
          {...register('password')}
        />
        <FieldError
          id="login-password-error"
          message={errors.password?.message}
        />
      </div>

      {failure && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-hf-control border border-hf-destructive bg-hf-bg-card p-3 text-sm text-hf-destructive-text"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {failure}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        disabled={waiting}
        className="w-full"
      >
        {waiting ? `Thử lại sau ${secondsLeft} giây` : 'Đăng nhập'}
      </Button>
    </form>
  );
}
