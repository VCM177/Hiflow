import {
  JOB_HTML_ALLOWED_ATTRIBUTES,
  JOB_HTML_ALLOWED_SCHEMES,
  JOB_HTML_ALLOWED_TAGS,
  JOB_HTML_LINK_ATTRIBUTES,
} from '@hiflow/shared-types';
import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...JOB_HTML_ALLOWED_TAGS],
  allowedAttributes: { ...JOB_HTML_ALLOWED_ATTRIBUTES },
  allowedSchemes: [...JOB_HTML_ALLOWED_SCHEMES],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { ...JOB_HTML_LINK_ATTRIBUTES }),
  },
};

/**
 * Cleans a job description before it is stored. The public page cleans it again when it
 * draws it; this keeps scripts out of the database and out of every other client.
 */
export function sanitizeJobHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** For `@Transform`: cleans strings, leaves anything else for the validators to refuse. */
export const sanitizeJobHtmlTransform = ({
  value,
}: {
  value: unknown;
}): unknown => (typeof value === 'string' ? sanitizeJobHtml(value) : value);
