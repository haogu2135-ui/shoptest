import { stripUnsafeHtml } from './sanitizeHtml';

describe('stripUnsafeHtml', () => {
  it('uses DOMPurify instead of a custom template-only sanitizer', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, 'sanitizeHtml.ts'), 'utf8') as string;

    expect(source).toContain("import DOMPurify from 'dompurify'");
    expect(source).toContain('DOMPurify.sanitize');
    expect(source).not.toContain("document.createElement('template')");
  });

  it('removes executable markup and event handlers', () => {
    const html = stripUnsafeHtml('<p onclick="alert(1)">Hi</p><script>alert(2)</script>');

    expect(html).toBe('<p>Hi</p>');
  });

  it('removes event handlers split across newlines', () => {
    const html = stripUnsafeHtml(
      '<div\nonclick\n=\n"alert(1)">Hi</div><img src="/images/pet.png"\nonerror\n=\n"alert(2)">'
    );

    expect(html).toContain('<div>Hi</div>');
    expect(html).toContain('<img src="/images/pet.png">');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('alert(2)');
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

  it('adds rel protection to case-insensitive blank targets', () => {
    const html = stripUnsafeHtml('<a href="https://example.com" target="_BLANK">external</a>');

    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('keeps only allowlisted rich text tags and unwraps unknown markup', () => {
    const html = stripUnsafeHtml('<custom-card data-id="1"><p>Promo <strong>deal</strong></p></custom-card>');

    expect(html).toBe('<p>Promo <strong>deal</strong></p>');
    expect(html).not.toContain('custom-card');
    expect(html).not.toContain('data-id');
  });

  it('removes non-allowlisted attributes from safe tags', () => {
    const html = stripUnsafeHtml('<p class="hero" style="color:red" title=" Deal ">Copy</p>');

    expect(html).toBe('<p title="Deal">Copy</p>');
    expect(html).not.toContain('class=');
    expect(html).not.toContain('style=');
  });

  it('removes executable containers with their content', () => {
    const html = stripUnsafeHtml('<p>Before</p><svg><a href="javascript:alert(1)">bad</a></svg><p>After</p>');

    expect(html).toBe('<p>Before</p><p>After</p>');
    expect(html).not.toContain('bad');
  });

  it('restricts image attributes to safe media urls and plain metadata', () => {
    const html = stripUnsafeHtml('<img src="mailto:test@example.com" alt=" Pet " width="640" height="99999" onerror="alert(1)">');

    expect(html).toBe('<img alt="Pet" width="640">');
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('height=');
    expect(html).not.toContain('onerror');
  });

  it('removes data urls from rich text links and images', () => {
    const html = stripUnsafeHtml(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">bad</a>'
        + '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+" alt="Pet">'
    );

    expect(html).toContain('<a>bad</a>');
    expect(html).toContain('<img alt="Pet">');
    expect(html).not.toContain('data:');
    expect(html).not.toContain('onload');
  });
});
