import { describe, expect, it } from 'vitest';

import { jobHtmlToText, sanitizeJobHtml } from './sanitize-job-html';

describe('sanitizeJobHtml', () => {
  it('keeps simple formatting', () => {
    expect(
      sanitizeJobHtml('<p>Xin <strong>chào</strong></p><ul><li>a</li></ul>'),
    ).toBe('<p>Xin <strong>chào</strong></p><ul><li>a</li></ul>');
  });

  it('removes script elements and their content', () => {
    expect(sanitizeJobHtml('<p>ok</p><script>alert(1)</script>')).toBe(
      '<p>ok</p>',
    );
  });

  it('removes event handler attributes', () => {
    const out = sanitizeJobHtml(
      '<p onclick="x()">a</p><img src=x onerror="x()">',
    );
    expect(out).toBe('<p>a</p>');
  });

  it('removes javascript: links but keeps the text', () => {
    const out = sanitizeJobHtml('<a href="javascript:alert(1)">bấm</a>');
    expect(out).not.toContain('javascript');
    expect(out).toContain('bấm');
  });

  it('removes iframes and styles', () => {
    const out = sanitizeJobHtml(
      '<iframe src="https://evil.test"></iframe><style>p{}</style><p style="color:red">a</p>',
    );
    expect(out).toBe('<p>a</p>');
  });

  it('opens http links safely', () => {
    const out = sanitizeJobHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it('returns an empty string for nothing', () => {
    expect(sanitizeJobHtml(null)).toBe('');
    expect(sanitizeJobHtml(undefined)).toBe('');
  });
});

describe('jobHtmlToText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(jobHtmlToText('<p>Một</p>\n<p>hai   ba</p>')).toBe('Một hai ba');
  });
});
