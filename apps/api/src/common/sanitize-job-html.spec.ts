import { sanitizeJobHtml, sanitizeJobHtmlTransform } from './sanitize-job-html';

describe('sanitizeJobHtml', () => {
  it('keeps the formatting an editor produces', () => {
    const html =
      '<h2>Yêu cầu</h2><p>Biết <strong>NestJS</strong></p><ul><li>a</li></ul>';
    expect(sanitizeJobHtml(html)).toBe(html);
  });

  it('removes scripts, handlers, iframes and styles', () => {
    expect(
      sanitizeJobHtml(
        '<p onclick="x()" style="color:red">a</p><script>alert(1)</script><iframe src="https://e.test"></iframe><img src=x onerror=y>',
      ),
    ).toBe('<p>a</p>');
  });

  it('drops javascript: links and hardens the others', () => {
    expect(
      sanitizeJobHtml('<a href="javascript:alert(1)">x</a>'),
    ).not.toContain('javascript');
    const out = sanitizeJobHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it('transform leaves non-strings alone', () => {
    expect(sanitizeJobHtmlTransform({ value: 5 })).toBe(5);
    expect(sanitizeJobHtmlTransform({ value: undefined })).toBeUndefined();
    expect(
      sanitizeJobHtmlTransform({ value: '<b>a</b><script>x</script>' }),
    ).toBe('<b>a</b>');
  });
});
