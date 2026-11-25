import React, { useLayoutEffect } from 'react'
import Markdown, { type Components } from 'react-markdown'
import styled from 'styled-components'
import { EvidenceLink, evidenceHref, splitUrls } from './item-standard-linkify'

/*
 * Evidence written in Markdown, as the parties and jurors meant it to read.
 * Its own chunk: only a description with Markdown in it loads it
 * (evidence-markdown-guard.ts), and plain text never does.
 *
 * CommonMark, and nothing beyond it: no tables, no raw HTML. Five constructs
 * are off because plain evidence trips them (read on 3,000 descriptions):
 *
 * - indented code: a paragraph indented four spaces or a tab became a
 *   monospaced box that scrolls sideways;
 * - setext headings: a line of dashes under a paragraph, written as a
 *   divider, turned the whole paragraph into a heading;
 * - raw HTML: "<deployment-id>" in a sentence is a tag to the parser, and
 *   any tag stays text as written;
 * - link definitions: a "[1]: https://…" line would vanish from the text.
 *
 * Every link follows the plain text's rules: https and ipfs:// only, each
 * through the external-link warning. A link whose words are not its own
 * address shows its host after it, so "[Etherscan](https://…)" says where it
 * goes before anyone clicks. An image is a link to it, never loaded: the
 * author would see who read their evidence. Headings are bold lines, not the
 * page's headings. Each line break shows, as in the plain text.
 */

const OFF = [
  'codeIndented',
  'setextUnderline',
  'htmlFlow',
  'htmlText',
  'definition',
]

// The processor's data, where remark-parse reads its syntax extensions (as
// remark-gfm adds its own).
function evidenceSyntax(this: { data(): object }) {
  const data = this.data() as { micromarkExtensions?: unknown[] }
  data.micromarkExtensions = [
    ...(data.micromarkExtensions ?? []),
    { disable: { null: OFF } },
  ]
}

interface MdNode {
  type: string
  value?: string
  url?: string
  alt?: string | null
  children?: MdNode[]
  position?: { start?: { offset?: number }; end?: { offset?: number } }
}

/** Where Markdown itself sets the words: code, links, images. */
const SET_BY_MARKDOWN = new Set(['inlineCode', 'code', 'link', 'image'])

const setByMarkdown = (
  node: MdNode,
  ranges: Array<[number, number]> = [],
): Array<[number, number]> => {
  const from = node.position?.start?.offset
  const to = node.position?.end?.offset
  if (SET_BY_MARKDOWN.has(node.type) && from !== undefined && to !== undefined)
    ranges.push([from, to])
  else node.children?.forEach((child) => setByMarkdown(child, ranges))
  return ranges
}

// What Markdown reads inside a bare URL: emphasis, code, links, character
// references, escapes.
const MEANINGFUL = /[\\`*_[\]&!]/g

/**
 * Where a URL's closing `*` and `_` begin, counted back from its end in one
 * pass (as linkify's trailing punctuation is: an anchored `[*_]+$` retries
 * every run of them).
 */
const emphasisTail = (url: string): number => {
  let end = url.length
  while (end > 0 && (url[end - 1] === '*' || url[end - 1] === '_')) end -= 1
  return end
}

/**
 * The source with each bare URL's Markdown characters escaped, so the URL
 * stays one piece of text: "…/__init__.py" would lose its underscores to
 * bold, and its link would end before them. A `*` or `_` ending the URL is
 * left to close emphasis around it ("*see https://…*"). URLs in code, links
 * and images are Markdown's own and stay as written.
 */
const escapeBareUrls = (source: string, kept: Array<[number, number]>) => {
  let offset = 0
  return splitUrls(source)
    .map((piece) => {
      if (typeof piece === 'string') {
        offset += piece.length
        return piece
      }
      const start = offset
      offset += piece.url.length
      if (kept.some(([from, to]) => start < to && offset > from))
        return piece.url
      const end = emphasisTail(piece.url)
      return (
        piece.url.slice(0, end).replace(MEANINGFUL, String.raw`\$&`) +
        piece.url.slice(end)
      )
    })
    .join('')
}

/** Inside these, text stays as written: a link's own words, code. */
const KEEP = new Set(['link', 'inlineCode', 'code'])

/**
 * An image in a link's words reads as its own words: an image is shown as a
 * link, and a link inside a link is two links in one place.
 */
const imagesToWords = (node: MdNode) => {
  if (!node.children) return
  node.children = node.children.map((child) => {
    if (child.type === 'image')
      return { type: 'text', value: child.alt || 'Image' }
    imagesToWords(child)
    return child
  })
}

/** A text node as lines with breaks between, each URL a link. */
const toNodes = (value: string): MdNode[] =>
  value.split(/\r\n|\r|\n/).flatMap((line, index) => [
    ...(index > 0 ? [{ type: 'break' }] : []),
    ...splitUrls(line).map(
      (piece): MdNode =>
        typeof piece === 'string'
          ? { type: 'text', value: piece }
          : {
              type: 'link',
              url: piece.url,
              children: [{ type: 'text', value: piece.url }],
            },
    ),
  ])

const walk = (node: MdNode) => {
  if (node.type === 'link') imagesToWords(node)
  if (!node.children || KEEP.has(node.type)) return
  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && child.value) return toNodes(child.value)
    walk(child)
    return [child]
  })
}

// Parsed again, with the same syntax, only when a bare URL had something to
// escape.
function evidenceText(this: { parse(document: string): unknown }) {
  const parse = (document: string) => this.parse(document) as MdNode
  // The file is react-markdown's VFile: its toString() is the source.
  return (tree: MdNode, file: { toString(): string }) => {
    const source = file.toString()
    const escaped = escapeBareUrls(source, setByMarkdown(tree))
    if (escaped !== source) tree.children = parse(escaped).children
    walk(tree)
  }
}

const remarkPlugins = [evidenceSyntax, evidenceText]

const textOf = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children)
  return ''
}

const Aside = styled.span`
  color: var(--color-muted);
  overflow-wrap: anywhere;
  /* A right-to-left override written before it (U+202E) cannot turn the
     host around: "(evil.com)" would read "(moc.live)". */
  unicode-bidi: isolate;
`

/** An address as the URL parser writes it, or as given if it is none. */
const normalized = (address: string) => {
  try {
    return new URL(address).href
  } catch {
    return address
  }
}

/** A link from the text: opened through the warning, or kept as words. */
const Anchor = ({
  url = '',
  children,
}: {
  url?: string
  children?: React.ReactNode
}) => {
  const href = evidenceHref(url)
  const words = textOf(children).trim()
  const label = words ? children : url
  // Its words are its address: as written ("…/Bogotá"), or as the link
  // holds it ("…/Bogot%C3%A1").
  const self =
    !words ||
    normalized(words) === normalized(url) ||
    words === href ||
    `mailto:${words}` === url
  if (!href)
    return (
      <>
        {label}
        {!self && url && <Aside> ({url})</Aside>}
      </>
    )
  const host = /^ipfs:/i.test(url)
    ? 'IPFS'
    : new URL(href).hostname.replace(/^www\./, '')
  return (
    <>
      <EvidenceLink href={href}>{label}</EvidenceLink>
      {!self && <Aside> ({host})</Aside>}
    </>
  )
}

const Heading = styled.p`
  font-weight: 600;
`

const heading = ({ children }: { children?: React.ReactNode }) => (
  <Heading>{children}</Heading>
)

const components: Components = {
  a: ({ href, children }) => <Anchor url={href}>{children}</Anchor>,
  img: ({ src, alt }) => <Anchor url={src}>{alt || 'Image'}</Anchor>,
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
}

// Every address is checked where it renders (Anchor), ipfs:// included.
const keepUrl = (url: string) => url

// What CommonMark without HTML makes, and nothing else: an element a later
// plugin might add (with an address Anchor never saw) is dropped, its text
// kept.
const ALLOWED = [
  'p',
  'br',
  'em',
  'strong',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'hr',
  'a',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]

const Body = styled.div`
  max-width: 68ch;
  overflow-wrap: anywhere;

  /* Doubled, to outrank the quote's own paragraph rules (no margin, and
     pre-line, which keeps a plain text's line breaks: here each one is a
     <br>, and pre-line would add a second). */
  && p {
    white-space: normal;
  }

  && > * + *,
  && blockquote > * + *,
  && li > * + * {
    margin-top: 10px;
  }

  ul,
  ol {
    margin: 0;
    padding-left: 1.5em;
  }

  li + li,
  li > ul,
  li > ol {
    margin-top: 4px;
  }

  blockquote {
    margin: 0;
    padding-left: 12px;
    border-left: 2px solid var(--glass-border);
    color: var(--color-muted);
  }

  blockquote p {
    color: inherit;
  }

  && hr {
    margin: 14px 0;
    border: 0;
    border-top: 1px solid var(--glass-border);
  }

  strong {
    font-weight: 600;
  }

  code {
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    background: var(--color-raised);
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  pre {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
    border-radius: var(--radius-sm);
    background: var(--color-raised);
    overflow-wrap: normal;

    code {
      padding: 0;
      background: none;
    }
  }
`

const EvidenceMarkdown = ({
  text,
  onShown,
}: {
  text: string
  /** Called once the formatted text is on screen, to measure its height. */
  onShown?: () => void
}) => {
  useLayoutEffect(() => {
    onShown?.()
  }, [onShown])
  return (
    <Body>
      <Markdown
        remarkPlugins={remarkPlugins}
        components={components}
        urlTransform={keepUrl}
        allowedElements={ALLOWED}
        unwrapDisallowed
      >
        {text}
      </Markdown>
    </Body>
  )
}

export default EvidenceMarkdown
