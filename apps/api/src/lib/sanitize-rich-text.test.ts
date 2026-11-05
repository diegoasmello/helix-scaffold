import { describe, expect, it } from 'vitest'

import { sanitizeRichText } from './sanitize-rich-text'

describe('sanitizeRichText', () => {
  // Everything the editor writes comes back unchanged.
  it.each([
    '<p>Plain <strong>bold</strong> <em>italic</em> <u>under</u> <s>strike</s></p>',
    '<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>',
    '<ul><li><p>a</p></li></ul><ol start="3"><li><p>b</p></li></ol>',
    '<blockquote><p>Quote</p></blockquote>',
    '<pre><code class="language-ts">const a = 1</code></pre>',
    '<p>x<sup>2</sup> H<sub>2</sub>O <mark>hi</mark> <code>c</code></p>',
    '<p style="text-align:center">Centered</p>',
    '<p>a<br />b</p><hr />',
    '<p><a href="https://example.com">link</a> <a href="mailto:a@b.co">mail</a></p>',
    '<img src="http://localhost:3333/api/files/f/original.png" alt="Alt" />',
  ])('keeps %s', (html) => {
    expect(sanitizeRichText(html)).toBe(html)
  })

  it('removes a script with its content', () => {
    expect(sanitizeRichText('<p>a</p><script>alert(1)</script>')).toBe(
      '<p>a</p>'
    )
  })

  it('removes event handlers', () => {
    expect(
      sanitizeRichText('<img src="https://x.co/a.png" onerror="alert(1)" />')
    ).toBe('<img src="https://x.co/a.png" />')
    expect(sanitizeRichText('<p onclick="alert(1)">a</p>')).toBe('<p>a</p>')
  })

  it('removes javascript: and data: URLs', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a>x</a>'
    )
    expect(sanitizeRichText('<a href="JaVaScRiPt&colon;alert(1)">x</a>')).toBe(
      '<a>x</a>'
    )
    expect(
      sanitizeRichText('<img src="data:image/svg+xml;base64,PHN2Zz4=" />')
    ).toBe('<img />')
  })

  it('removes a protocol-relative URL', () => {
    expect(sanitizeRichText('<img src="//evil.example/a.png" />')).toBe(
      '<img />'
    )
  })

  it.each([
    '<iframe src="https://evil.example"></iframe>',
    '<object data="x"></object>',
    '<embed src="x" />',
    '<form action="https://evil.example"><input name="a" /></form>',
    '<style>body { display: none }</style>',
    '<svg><script>alert(1)</script></svg>',
  ])('removes %s', (html) => {
    expect(sanitizeRichText(`<p>a</p>${html}`)).toBe('<p>a</p>')
  })

  it('keeps the text of a tag it removes, as text', () => {
    expect(
      sanitizeRichText('<div><span>a</span></div><math><mi>x</mi></math>')
    ).toBe('ax')
  })

  it('keeps only text-align in style', () => {
    expect(
      sanitizeRichText(
        '<p style="text-align:right;background:url(https://evil.example)">a</p>'
      )
    ).toBe('<p style="text-align:right">a</p>')
    expect(sanitizeRichText('<p style="position:fixed">a</p>')).toBe('<p>a</p>')
  })

  it('removes classes other than the code block language', () => {
    expect(sanitizeRichText('<p class="admin-only">a</p>')).toBe('<p>a</p>')
    expect(sanitizeRichText('<code class="language-js evil">a</code>')).toBe(
      '<code class="language-js">a</code>'
    )
  })

  // Reverse tabnabbing: the page a link opens never gets `window.opener`.
  describe('links that open another window', () => {
    const safe =
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>'

    it.each([
      '<a href="https://example.com" target="_blank" rel="opener">x</a>',
      '<a href="https://example.com" target="_BLANK" rel="opener">x</a>',
      '<a href="https://example.com" target=" _Blank " rel="opener">x</a>',
      '<a href="https://example.com" target="_blank">x</a>',
    ])('makes %s noopener', (html) => {
      expect(sanitizeRichText(html)).toBe(safe)
    })

    it('drops a named target, which keeps the opener', () => {
      expect(
        sanitizeRichText(
          '<a href="https://example.com" target="evilwin" rel="opener">x</a>'
        )
      ).toBe('<a href="https://example.com">x</a>')
    })

    it('drops the rel sent on a link without target', () => {
      expect(
        sanitizeRichText('<a href="https://example.com" rel="opener">x</a>')
      ).toBe('<a href="https://example.com">x</a>')
    })
  })
})
