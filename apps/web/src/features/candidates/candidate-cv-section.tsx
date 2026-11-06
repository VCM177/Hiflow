'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RHFFileField } from '@/components/shared/form/rhf-file-field';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { applyApiError } from '@/lib/forms/apply-api-error';
import { CV_HINT, cvFileError } from '@/lib/validations';

import {
  candidateCvUrl,
  removeCandidateCv,
  uploadCandidateCv,
  type CandidateDetail,
} from './candidate-api';
import { CANDIDATE_PERMISSION } from './constants';

const cvSchema = z.object({
  file: z
    .custom<File | null>((value) => value === null || value instanceof File)
    .superRefine((file, context) => {
      const message = file ? cvFileError(file) : 'Vui lòng chọn tệp CV.';
      if (message) context.addIssue({ code: 'custom', message });
    }),
});
type CvValues = z.infer<typeof cvSchema>;

function UploadForm({
  candidateId,
  replacing,
  onChanged,
}: {
  candidateId: string;
  replacing: boolean;
  onChanged: () => Promise<void>;
}) {
  const form = useForm<CvValues>({
    resolver: zodResolver(cvSchema),
    defaultValues: { file: null },
  });
  const [inputKey, setInputKey] = React.useState(0);
  const { isSubmitting } = form.formState;

  async function onSubmit(values: CvValues) {
    if (!values.file) return;
    try {
      await uploadCandidateCv(candidateId, values.file);
      await onChanged();
      form.reset({ file: null });
      // A file input cannot be emptied from the outside; a new key mounts a fresh one.
      setInputKey((key) => key + 1);
      toast.success(replacing ? 'Đã thay CV' : 'Đã tải CV lên');
    } catch (error) {
      const result = applyApiError(error, form.setError, 'file');
      if (result.kind !== 'field') toast.error(result.message);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-w-md flex-col gap-3"
    >
      <RHFFileField
        key={inputKey}
        control={form.control}
        name="file"
        label={replacing ? 'Thay bằng CV mới' : 'Tải CV lên'}
        hint={CV_HINT}
        accept=".pdf,.docx"
      />
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {replacing ? 'Thay CV' : 'Tải lên'}
        </Button>
      </div>
    </form>
  );
}

/** The CV of a candidate: download for everyone who may read it, upload and remove for those who manage it. */
export function CandidateCvSection({
  candidate,
  onChanged,
}: {
  candidate: CandidateDetail;
  onChanged: () => Promise<void>;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const editable = candidate.anonymizedAt === null;

  return (
    <SectionCard title="CV">
      <div className="flex flex-col gap-4">
        {candidate.hasCv ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Opens in a new tab. Never prefetched: a visit would count as a download. */}
            <Link
              href={candidateCvUrl(candidate.id)}
              prefetch={false}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Download aria-hidden="true" />
              Tải CV
            </Link>
            {editable && (
              <PermissionGate permission={CANDIDATE_PERMISSION.cv}>
                <Button onClick={() => setConfirming(true)}>Xóa CV</Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <p className="text-sm text-hf-text-muted">Chưa có CV.</p>
        )}
        {editable && (
          <PermissionGate permission={CANDIDATE_PERMISSION.cv}>
            <UploadForm
              candidateId={candidate.id}
              replacing={candidate.hasCv}
              onChanged={onChanged}
            />
          </PermissionGate>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Xóa CV"
        description="Tệp CV của ứng viên sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác."
        confirmLabel="Xóa CV"
        onConfirm={async () => {
          await removeCandidateCv(candidate.id);
          await onChanged();
          toast.success('Đã xóa CV');
        }}
      />
    </SectionCard>
  );
}
