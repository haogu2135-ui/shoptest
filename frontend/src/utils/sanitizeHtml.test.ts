import { stripUnsafeHtml } from './sanitizeHtml';

describe('stripUnsafeHtml', () => {
  it('removes executable markup and event handlers', () => {
    const html = stripUnsafeHtml('<p onclick="alert(1)">Hi</p><script>alert(2)</script>');

    expect(html).toBe('<p>Hi</p>');
  });

  it('removes unsafe and protocol-relative urls', () => {
    const html = stripUnsafeHtml(
      '<a href="javascript:alert(1)">bad</a><img src="//tracker.example/pixel.png"><a href="/orders">ok</a>'
    );

    expect(html).toContain('<a>bad</a>');
    expect(html).toContain('<img>');
    expect(html).toContain('<a href="/orders">ok</a>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('//tracker.example');
  });

  it('removes credentialed urls from rich text links', () => {
    const html = stripUnsafeHtml('<a href="https://user:pass@example.com/path">phishy</a>');

    expect(html).toBe('<a>phishy</a>');
  });

  it('removes backslash-obfuscated rich text urls', () => {
    const html = stripUnsafeHtml('<a href="https:\\\\example.com">bad</a><a href="/orders%5cadmin">also bad</a>');

    expect(html).toBe('<a>bad</a><a>also bad</a>');
  });

  it('adds rel protection to links opened in a new tab', () => {
    const html = stripUnsafeHtml('<a href="https://example.com" target="_blank">external</a>');

    expect(html).toContain('rel="noopener noreferrer"');
  });
});
