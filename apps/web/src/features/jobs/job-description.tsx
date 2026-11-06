'use client';

import * as React from 'react';

import { sanitizeJobHtml } from '@/lib/sanitize-job-html';

/**
 * A description drawn on a staff page. Whatever the API stored goes through the one
 * sanitiser first, as on the public page.
 */
export function JobDescription({ html }: { html: string | null }) {
  const clean = React.useMemo(() => sanitizeJobHtml(html), [html]);
  if (!clean) {
    return <p className="text-sm text-hf-text-muted">Chưa có mô tả.</p>;
  }
  return (
    <div
      className="job-description text-sm text-hf-text-body"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
