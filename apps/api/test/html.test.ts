import { describe, expect, it } from 'vitest';
import { sanitizeDescriptionHtml as clean } from '../src/catalog/html/sanitize';

describe('sanitizeDescriptionHtml', () => {
  it('keeps allowed formatting, links, tables and images', () => {
    const html =
      '<h2>Title</h2><p><b>bold</b> <i>it</i> <u>u</u> <a href="https://example.com/x">link</a> <a href="mailto:a@b.co">mail</a></p>' +
      '<ul><li>one</li></ul><table><thead><tr><th colspan="2">H</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>' +
      '<img src="https://cdn.example.com/a.jpg" alt="x">';
    const out = clean(html);
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).toContain('<table>');
    expect(out).toContain('<th colspan="2">H</th>');
    expect(out).toContain('<img src="https://cdn.example.com/a.jpg" alt="x" />');
  });

  it('allows YouTube embeds only', () => {
    expect(clean('<iframe src="https://www.youtube.com/embed/abc123"></iframe>')).toContain(
      'https://www.youtube.com/embed/abc123',
    );
    expect(
      clean('<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>'),
    ).toContain('youtube-nocookie.com/embed/abc123');
    for (const src of [
      'https://evil.com/embed/abc',
      'https://www.youtube.com/watch?v=abc',
      'https://youtube.com.evil.com/embed/abc',
      'javascript:alert(1)',
      '//evil.com/embed/x',
      '/embed/abc',
    ]) {
      expect(clean(`<iframe src="${src}"></iframe>`), src).not.toContain('iframe');
    }
  });

  it('keeps safe inline styles and drops dangerous ones', () => {
    const ok = clean('<p style="color: red; text-align:center; font-weight: bold">x</p>');
    expect(ok).toContain('color:red');
    expect(ok).toContain('text-align:center');
    expect(clean('<p style="background-color: rgb(1, 2, 3)">x</p>')).toContain('background-color');
    for (const style of [
      'background: url(javascript:alert(1))',
      'background-color: url(http://x/y.png)',
      'width: expression(alert(1))',
      'position: fixed; top: 0',
      'color: red; position:fixed',
      'behavior: url(x.htc)',
      'color: \\72 ed',
    ]) {
      const out = clean(`<p style="${style}">x</p>`);
      expect(out, style).not.toMatch(/url|expression|fixed|behavior|\\/i);
    }
  });

  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<svg><script>alert(1)</script></svg>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<img src="javascript:alert(1)">',
    '<img src="data:image/png;base64,AAAA">',
    '<img src="//evil.com/x.png">',
    '<img src="/relative.png">',
    '<body onload=alert(1)>',
    '<div onmouseover="alert(1)">x</div>',
    '<form action="/x"><input name=a><button>go</button></form>',
    '<object data="x.swf"></object>',
    '<embed src="x.swf">',
    '<style>body{display:none}</style>',
    '<link rel="stylesheet" href="http://evil/x.css">',
    '<meta http-equiv="refresh" content="0;url=http://evil">',
    '<base href="http://evil/">',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<video src=x onerror=alert(1)></video>',
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
  ];

  for (const payload of payloads) {
    it(`neutralises ${payload.slice(0, 40)}`, () => {
      const out = clean(payload);
      expect(out).not.toMatch(
        /<script|<img|<style|<form|<input|<object|<embed|<link|<meta|<base|<svg|<math|<video|<iframe|<button|\son\w+=|javascript:|data:|srcdoc|\/\/evil/i,
      );
    });
  }

  it('removes script contents rather than leaving them as text', () => {
    expect(clean('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
    expect(clean('<style>body{}</style>ok')).toBe('ok');
  });

  it('is idempotent', () => {
    const once = clean('<p style="color:red"><a href="https://x.co">a</a></p><script>x</script>');
    expect(clean(once)).toBe(once);
  });
});
