import sanitizeHtml from 'sanitize-html';

/**
 * The only way job descriptions reach the page. Staff write rich text, the page is
 * public, so everything outside this small allowlist is dropped: scripts, event
 * handlers, iframes, styles, and any link that is not http(s) or mailto.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'a',
  ],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer nofollow',
      target: '_blank',
    }),
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
