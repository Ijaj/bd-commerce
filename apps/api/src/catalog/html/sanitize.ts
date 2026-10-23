import sanitizeHtml from 'sanitize-html';

const YOUTUBE_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
];

// Rejects url(), expression(), image-set, var(), @import and backslash escapes in any value.
const NO_BAD =
  '(?!.*(?:url|expression|image-set|var|import|javascript|behavior|binding)|.*[\\\\@])';
const color = new RegExp(`^${NO_BAD}[#\\w\\s.,%()/-]{1,60}$`, 'i');
const length = new RegExp(
  `^${NO_BAD}-?[\\d.]+(?:px|em|rem|%|pt|vw|vh)?(?:\\s+-?[\\d.]+(?:px|em|rem|%|pt)?){0,3}$`,
  'i',
);
const keyword = (...words: string[]) => new RegExp(`^(?:${words.join('|')})$`, 'i');

const allowedStyles: NonNullable<sanitizeHtml.IOptions['allowedStyles']> = {
  '*': {
    color: [color],
    'background-color': [color],
    'text-align': [keyword('left', 'right', 'center', 'justify')],
    'text-decoration': [keyword('none', 'underline', 'line-through')],
    'font-size': [length],
    'font-weight': [keyword('normal', 'bold', 'bolder', 'lighter', '[1-9]00')],
    'font-style': [keyword('normal', 'italic')],
    'line-height': [length],
    'letter-spacing': [length],
    'vertical-align': [keyword('baseline', 'top', 'middle', 'bottom', 'sub', 'super')],
    width: [length],
    height: [length],
    'max-width': [length],
    margin: [length],
    'margin-top': [length],
    'margin-bottom': [length],
    'margin-left': [length],
    'margin-right': [length],
    padding: [length],
    'padding-top': [length],
    'padding-bottom': [length],
    'padding-left': [length],
    'padding-right': [length],
    border: [new RegExp(`^${NO_BAD}[#\\w\\s.,%()-]{1,60}$`, 'i')],
    'border-collapse': [keyword('collapse', 'separate')],
    float: [keyword('left', 'right', 'none')],
    display: [keyword('block', 'inline', 'inline-block', 'table', 'none')],
  },
};

/** YouTube embed urls only: https://www.youtube(-nocookie).com/embed/<id>. */
function isYoutubeEmbed(src: string | undefined) {
  if (!src) return false;
  try {
    const u = new URL(src);
    return (
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      YOUTUBE_HOSTS.includes(u.hostname) &&
      u.pathname.startsWith('/embed/')
    );
  } catch {
    return false;
  }
}

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'div',
    'span',
    'blockquote',
    'pre',
    'code',
    'ul',
    'ol',
    'li',
    'b',
    'i',
    'u',
    's',
    'strong',
    'em',
    'sub',
    'sup',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
    'iframe',
  ],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'title', 'frameborder'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    col: ['span'],
  },
  allowedStyles,
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['http', 'https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: YOUTUBE_HOSTS,
  allowIframeRelativeUrls: false,
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target && out.target !== '_blank') delete out.target;
      if (out.href) out.rel = 'noopener noreferrer nofollow';
      return { tagName, attribs: out };
    },
  },
  exclusiveFilter: (frame) =>
    (frame.tag === 'iframe' && !isYoutubeEmbed(frame.attribs.src)) ||
    (frame.tag === 'img' && !/^https?:\/\//i.test(frame.attribs.src ?? '')),
};

/**
 * Q28: product descriptions are sanitized on save and again on render.
 * Strips scripts, handlers, javascript:/data: urls, non-YouTube iframes, forms and embeds.
 */
export function sanitizeDescriptionHtml(html: string): string {
  return sanitizeHtml(html, options);
}
