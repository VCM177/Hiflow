'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { USER_ROLE_LABEL, type AuthUser } from '@hiflow/shared-types';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { describeApiError } from '@/lib/api/describe-error';
import { sessionQueryKey } from '@/lib/auth/session';

import {
  changePassword,
  fetchProfile,
  profileQueryKey,
  updateProfileName,
  type Profile,
} from './profile-api';
import { describePasswordError } from './password-error';
import {
  changePasswordSchema,
  profileNameSchema,
  type ChangePasswordValues,
  type ProfileNameValues,
} from './profile-schema';

function NameForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const form = useForm<ProfileNameValues>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName: profile.fullName },
  });
  const { isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: ProfileNameValues) {
    try {
      const saved = await updateProfileName(values.fullName);
      queryClient.setQueryData(profileQueryKey, saved);
      // The top bar reads the name from the session.
      queryClient.setQueryData<AuthUser>(sessionQueryKey, (user) =>
        user ? { ...user, fullName: saved.fullName } : user,
      );
      form.reset({ fullName: saved.fullName });
      toast.success('Đã lưu họ tên');
    } catch (error) {
      toast.error(describeApiError(error).message);
    }
  }

  return (
    <SectionCard title="Thông tin cá nhân">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-md flex-col gap-4"
      >
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-hf-text-muted">Email</dt>
          <dd className="text-hf-text-body">{profile.email}</dd>
          <dt className="text-hf-text-muted">Vai trò</dt>
          <dd className="text-hf-text-body">
            {USER_ROLE_LABEL[profile.role] ?? profile.role}
          </dd>
          <dt className="text-hf-text-muted">Phòng ban</dt>
          <dd className="text-hf-text-body">{profile.departmentName ?? '—'}</dd>
        </dl>
        <RHFTextField
          control={form.control}
          name="fullName"
          label="Họ và tên"
          required
          inputProps={{ maxLength: 100, autoComplete: 'name' }}
        />
        <div>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting && <Spinner />}
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function PasswordForm() {
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const { isSubmitting } = form.formState;

  async function onSubmit(values: ChangePasswordValues) {
    try {
      await changePassword(values);
      form.reset();
      toast.success('Đã đổi mật khẩu');
    } catch (error) {
      const failure = describePasswordError(error);
      if (failure.kind === 'field') {
        form.setError(
          failure.field,
          { type: 'server', message: failure.message },
          { shouldFocus: true },
        );
      } else {
        toast.error(failure.message);
      }
    }
  }

  return (
    <SectionCard
      title="Đổi mật khẩu"
      description="Bạn vẫn đăng nhập sau khi đổi."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-md flex-col gap-4"
      >
        <RHFTextField
          control={form.control}
          name="currentPassword"
          label="Mật khẩu hiện tại"
          required
          inputProps={{ type: 'password', autoComplete: 'current-password' }}
        />
        <RHFTextField
          control={form.control}
          name="newPassword"
          label="Mật khẩu mới"
          required
          hint="8 đến 72 ký tự, có ít nhất một chữ cái và một chữ số."
          inputProps={{ type: 'password', autoComplete: 'new-password' }}
        />
        <div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/** Every signed-in user's own page: their name and their password. */
export function ProfilePage() {
  const query = useQuery({
    queryKey: profileQueryKey,
    queryFn: ({ signal }) => fetchProfile(signal),
  });

  return (
    <>
      <PageHeader title="Hồ sơ cá nhân" />
      <div className="flex flex-col gap-6">
        {query.isPending ? (
          <Skeleton className="h-64 w-full max-w-xl" />
        ) : query.error ? (
          <ApiErrorView
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            {/* Mounted once the profile is here, so the form starts from the saved name. */}
            <NameForm profile={query.data} />
            <PasswordForm />
          </>
        )}
      </div>
    </>
  );
}
