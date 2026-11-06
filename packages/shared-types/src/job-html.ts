/**
 * What a job description may contain. Staff write it as rich text and the public reads it,
 * so both ends strip everything else: the API before it is stored, the web app before it
 * is drawn. One list, so the editor, the API and the page can never disagree.
 */
export const JOB_HTML_ALLOWED_TAGS = [
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
] as const;

export const JOB_HTML_ALLOWED_ATTRIBUTES: Readonly<Record<string, string[]>> = {
  a: ['href', 'rel', 'target'],
};

export const JOB_HTML_ALLOWED_SCHEMES = ['http', 'https', 'mailto'] as const;

/** Attributes forced onto every link so a description cannot reach back into the page. */
export const JOB_HTML_LINK_ATTRIBUTES = {
  rel: 'noopener noreferrer nofollow',
  target: '_blank',
} as const;
