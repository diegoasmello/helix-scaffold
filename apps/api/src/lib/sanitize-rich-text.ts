import sanitizeHtml from 'sanitize-html'

// What the web's `RichTextEditor` (`packages/ui`, TipTap) writes: StarterKit
// (paragraphs, headings, marks, lists, quotes, code), Link, Superscript,
// Subscript, Highlight, TextAlign and Image. A tag the editor can add goes
// here, or it disappears on save.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'br',
    'hr',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'sup',
    'sub',
    'mark',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    ol: ['start'],
    code: ['class'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
    h5: ['style'],
    h6: ['style'],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/] },
  },
  // `javascript:`, `data:` and any other scheme are dropped from `href`/`src`.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // `<script>`, `<style>` and the like go with their content, not as text.
  disallowedTagsMode: 'discard',
  transformTags: {
    // A link never hands the site's window to the page it opens (reverse
    // tabnabbing): the `rel` sent is always dropped, a `target` is kept only
    // as `_blank` — whatever its case or spaces, as browsers read it — with
    // `noopener`, and any other target (a named window) is dropped.
    a: (tagName, attribs) => {
      const { target, rel: _rel, ...rest } = attribs
      return {
        tagName,
        attribs:
          target?.trim().toLowerCase() === '_blank'
            ? { ...rest, target: '_blank', rel: 'noopener noreferrer nofollow' }
            : rest,
      }
    },
  },
}

/**
 * The HTML of a rich text field, reduced to what the editor writes: no
 * script, event handler, `style` other than `text-align`, `<iframe>`, form or
 * `javascript:` URL survives. The service calls it on every write of the field
 * — before `uploadIdsInHtml()` — so the stored HTML is safe wherever it is
 * rendered: the admin, and a public site that inserts it as HTML.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}
