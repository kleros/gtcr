import React from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import EvidenceMarkdown from './evidence-markdown'
import EvidenceText from './evidence-text'

// The renderer is a lazy chunk; loaded once here, each test then waits only
// for React to swap it in.
beforeAll(async () => {
  await import('./evidence-markdown')
})

const renderEvidence = (text: string) =>
  renderWithProviders(<EvidenceText text={text} />)

describe('EvidenceText', () => {
  it('shows text without Markdown as written, its URLs as links', () => {
    const text = 'Domain no longer functional.\nSee https://example.com/a.'
    const { container } = renderEvidence(text)
    expect(
      screen.getByRole('link', { name: 'https://example.com/a' }),
    ).toHaveAttribute('href', 'https://example.com/a')
    expect(container.querySelector('p')?.textContent).toBe(text)
  })

  it('renders emphasis, lists and each line break', async () => {
    const { container } = renderEvidence(
      'The tag *must* differ.\nA second line, **bold**.\n\n1. one\n2. two',
    )
    expect((await screen.findByText('must')).tagName).toBe('EM')
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelectorAll('br')).toHaveLength(1)
  })

  it('links https and ipfs only, saying where a named link goes', async () => {
    const { container } = renderEvidence(
      'Per [the spec](https://eips.ethereum.org/EIPS/eip-20), not ' +
        '[this](javascript:alert(1)) or [that](http://example.com). ' +
        'See ipfs://QmHash/file.json and <https://example.org>.',
    )
    expect(
      await screen.findByRole('link', { name: 'the spec' }),
    ).toHaveAttribute('href', 'https://eips.ethereum.org/EIPS/eip-20')
    expect(container.textContent).toContain('the spec (eips.ethereum.org)')
    expect(container.textContent).toContain('this (javascript:alert(1))')
    expect(container.textContent).toContain('that (http://example.com)')
    expect(container.querySelectorAll('a')).toHaveLength(3)
    expect(
      screen.getByRole('link', { name: 'ipfs://QmHash/file.json' }),
    ).toHaveAttribute('href', 'https://cdn.kleros.link/ipfs/QmHash/file.json')
    expect(
      screen.getByRole('link', { name: 'https://example.org' }),
    ).toBeInTheDocument()
  })

  it('opens a link only after the external-link warning', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderEvidence('Per [the spec](https://eips.ethereum.org/EIPS/eip-20).')
    await user.click(await screen.findByRole('link', { name: 'the spec' }))
    expect(await screen.findByText('Leaving Kleros Curate')).toBeVisible()
    expect(open).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Open site/ }))
    expect(open).toHaveBeenCalledWith(
      'https://eips.ethereum.org/EIPS/eip-20',
      '_blank',
      'noopener,noreferrer',
    )
    open.mockRestore()
  })

  it('never loads an image: it is a link to it', async () => {
    const { container } = renderEvidence(
      'Proof: ![screenshot](https://tracker.example/pixel.png)',
    )
    expect(
      await screen.findByRole('link', { name: 'screenshot' }),
    ).toHaveAttribute('href', 'https://tracker.example/pixel.png')
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('screenshot (tracker.example)')
  })

  it('reads an image inside a link as the words of the link', async () => {
    const { container } = renderEvidence(
      'Logo: [![the logo](https://cdn.example/logo.png)](https://example.com)',
    )
    expect(
      await screen.findByRole('link', { name: 'the logo' }),
    ).toHaveAttribute('href', 'https://example.com')
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.querySelector('a a')).toBeNull()
  })

  it('keeps a bare URL whole, whatever Markdown its address holds', async () => {
    const { container } = renderEvidence(
      'See https://example.com/pkg/__init__.py and https://example.com/a*b*c/x, *noted*.',
    )
    expect((await screen.findByText('noted')).tagName).toBe('EM')
    expect(
      screen.getByRole('link', { name: 'https://example.com/pkg/__init__.py' }),
    ).toHaveAttribute('href', 'https://example.com/pkg/__init__.py')
    expect(
      screen.getByRole('link', { name: 'https://example.com/a*b*c/x' }),
    ).toHaveAttribute('href', 'https://example.com/a*b*c/x')
    expect(container.querySelector('strong')).toBeNull()
  })

  it('still lets emphasis close around a URL, and code keep its own', async () => {
    const { container } = renderEvidence(
      '*see https://a.example/x* and **https://a.example/__y__** in `https://a.example/__z__`',
    )
    const link = await screen.findByRole('link', {
      name: 'https://a.example/x',
    })
    expect(link.closest('em')).not.toBeNull()
    expect(
      screen
        .getByRole('link', { name: 'https://a.example/__y__' })
        .closest('strong'),
    ).not.toBeNull()
    expect(container.querySelector('code')?.textContent).toBe(
      'https://a.example/__z__',
    )
  })

  it('says nothing more after a URL written with letters a link encodes', async () => {
    const { container } = renderEvidence(
      'Source: https://es.wikipedia.org/wiki/Bogotá _see_',
    )
    await screen.findByText('see')
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.textContent).not.toContain('(es.wikipedia.org)')
  })

  it('shows HTML as the text it is', async () => {
    const { container } = renderEvidence(
      'A gateway URL, e.g. .../deployments/id/<deployment-id>, *always*.\n\n' +
        '<script>alert(1)</script>',
    )
    await screen.findByText('always')
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('/id/<deployment-id>,')
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })

  it('reads indented text, dividers and headings as plain evidence meant', async () => {
    const { container } = renderEvidence(
      'Key Points:\n\n    Minor Issue: it does *not* matter\n\n' +
        'A paragraph above a divider\n-----\n\n# Title',
    )
    await screen.findByText('not')
    expect(container.querySelector('pre')).toBeNull()
    expect(container.querySelector('hr')).not.toBeNull()
    expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull()
    expect(screen.getByText('Title').tagName).toBe('P')
    expect(screen.getByText('A paragraph above a divider').tagName).toBe('P')
  })

  it('shows deep nesting as plain text, without parsing it', () => {
    const text = `${'- '.repeat(300)}a`
    const { container } = renderEvidence(text)
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe(text)
  })
})

/*
 * What evidence written to attack its readers tries: script, event
 * handlers, javascript:/data:/file: addresses (encoded, cased, bracketed),
 * HTML elements, images that load on sight, link definitions.
 */
const ATTACKS = [
  '[a](javascript:alert(1))',
  '[a](JaVaScRiPt:alert(1))',
  '[a](&#106;avascript:alert(1))',
  '[a](javascript&#58;alert(1))',
  '[a](<javascript:alert(1)>)',
  '[a]( javascript:alert(1) )',
  '[a](vbscript:msgbox(1))',
  '[a](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '[a](file:///etc/passwd)',
  '[a](//evil.example/x)',
  '[a](/relative/path)',
  '[a](https://example.com" onclick="alert(1))',
  '[a](https://example.com/"><script>alert(1)</script>)',
  '[a](https://example.com "x onmouseover=alert(1)")',
  '<javascript:alert(1)>',
  '<a href="javascript:alert(1)">x</a> *y*',
  '<img src=x onerror=alert(1)> *y*',
  '<svg onload=alert(1)> *y*',
  '<iframe src="https://evil.example"></iframe> *y*',
  '<style>body{display:none}</style> *y*',
  '![a](javascript:alert(1))',
  '![a](https://evil.example/pixel.png)',
  '![a" onerror="alert(1)](https://evil.example/p.png)',
  '[![a](https://evil.example/p.png)](javascript:alert(1))',
  '[a][1]\n\n[1]: javascript:alert(1)',
  '`<script>alert(1)</script>`',
  '```html\n<script>alert(1)</script>\n```',
  'see https://example.com/"onmouseover="alert(1) and *y*',
]

const expectHarmless = (container: HTMLElement) => {
  expect(
    container.querySelectorAll(
      'script, iframe, img, svg, style, object, embed, form, input, link, meta, base',
    ),
  ).toHaveLength(0)
  for (const element of container.querySelectorAll('*')) {
    for (const { name, value } of element.attributes) {
      expect(`${element.tagName} ${name}`).not.toMatch(/ (on|src$)/)
      // The one inline style: the link's own wrapper around its warning.
      if (name === 'style') expect(value).toBe('display: contents;')
    }
    const href = element.getAttribute('href')
    if (href !== null) expect(href).toMatch(/^https:\/\//)
  }
}

describe('evidence written to attack', () => {
  it.each(ATTACKS)('renders harmlessly: %s', async (text) => {
    // The plain text first (and while the renderer loads), then Markdown.
    const plain = renderEvidence(text)
    expectHarmless(plain.container)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expectHarmless(plain.container)
    plain.unmount()
    const { container } = renderWithProviders(<EvidenceMarkdown text={text} />)
    expectHarmless(container)
  })
})
