import {
  JOB_HTML_ALLOWED_ATTRIBUTES,
  JOB_HTML_ALLOWED_SCHEMES,
  JOB_HTML_ALLOWED_TAGS,
  JOB_HTML_LINK_ATTRIBUTES,
} from '@hiflow/shared-types';
import sanitizeHtml from 'sanitize-html';

/**
 * The only way job descriptions reach the page. Staff write rich text, the page is
 * public, so everything outside this small allowlist is dropped: scripts, event
 * handlers, iframes, styles, and any link that is not http(s) or mailto.
 */
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

export function sanitizeJobHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, OPTIONS);
}

/** Plain text of a description, for page metadata. */
export function jobHtmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}
