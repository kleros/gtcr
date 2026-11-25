import { describe, expect, it, vi } from 'vitest'
import {
  cssImageUrl,
  getAllowedAttachmentUrl,
  isSafeNavigationUrl,
} from './url-validation'

const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const ON_GATEWAY = `https://cdn.kleros.link/ipfs/${CID}/evidence.pdf`

describe('isSafeNavigationUrl', () => {
  it.each([
    'https://kleros.io',
    'https://curate.kleros.io/tcr/100/0xabc?x=1#y',
    '  https://kleros.io  ',
    'HTTPS://KLEROS.IO',
  ])('allows the https address %j', (url) => {
    expect(isSafeNavigationUrl(url)).toBe(true)
  })

  it.each([
    'http://kleros.io',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '  javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://kleros.io',
    '//evil.example',
    '/relative/path',
    'kleros.io',
    '',
  ])('refuses %j', (url) => {
    expect(isSafeNavigationUrl(url)).toBe(false)
  })

  it('refuses a missing or non-text value', () => {
    expect(isSafeNavigationUrl(undefined)).toBe(false)
    expect(isSafeNavigationUrl(null)).toBe(false)
    expect(isSafeNavigationUrl(5 as unknown as string)).toBe(false)
    expect(isSafeNavigationUrl({} as unknown as string)).toBe(false)
  })
})

describe('cssImageUrl', () => {
  // Inside url("…"): nothing that can end the string, the url() or the rule.
  const SAFE_CSS_URL = /^url\("[^\s"'()\\;{}]*"\)$/

  it('quotes an https image URL', () => {
    expect(cssImageUrl(ON_GATEWAY)).toBe(`url("${ON_GATEWAY}")`)
  })

  it.each([
    'http://cdn.kleros.link/logo.png',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    `/ipfs/${CID}/logo.png`,
    '//evil.example/logo.png',
    '',
    null,
    undefined,
  ])('gives nothing for %j', (url) => {
    expect(cssImageUrl(url)).toBeUndefined()
  })

  it.each([
    'https://x.test/a.png")}body{background:red}',
    "https://x.test/a.png');x:url('",
    'https://x.test/a.png) no-repeat; color: red',
    'https://x.test/a.png?q=");}*{display:none}',
    'https://x.test/a.png?q=\\"',
    'https://x.test/a.png\n");}',
    'https://x.test/{a}/b c.png',
  ])('cannot break out of the declaration: %j', (url) => {
    expect(cssImageUrl(url)).toMatch(SAFE_CSS_URL)
  })

  it('still names the same image once escaped', () => {
    const url = 'https://x.test/logo (1).png?size=(64)'
    const css = cssImageUrl(url) as string
    expect(css).toMatch(SAFE_CSS_URL)
    const inner = css.slice('url("'.length, -'")'.length)
    expect(decodeURIComponent(inner)).toBe(
      decodeURIComponent(new URL(url).href),
    )
  })

  it('keeps the escapes a URL already has', () => {
    expect(cssImageUrl('https://x.test/a%20b.png')).toBe(
      'url("https://x.test/a%20b.png")',
    )
  })
})

describe('getAllowedAttachmentUrl', () => {
  it('allows an https file under /ipfs/ on the gateway', () => {
    expect(getAllowedAttachmentUrl(ON_GATEWAY)).toBe(ON_GATEWAY)
  })

  it('gives the address in its normal form', () => {
    expect(
      getAllowedAttachmentUrl(`https://CDN.KLEROS.LINK:443/ipfs/${CID}/a.pdf`),
    ).toBe(`https://cdn.kleros.link/ipfs/${CID}/a.pdf`)
  })

  it.each([
    ['another host', `https://evil.example/ipfs/${CID}/a.pdf`],
    ['a lookalike host', `https://cdn.kleros.link.evil.example/ipfs/${CID}`],
    [
      'a host hidden after userinfo',
      `https://cdn.kleros.link@evil.example/ipfs/${CID}`,
    ],
    ['plain http', `http://cdn.kleros.link/ipfs/${CID}/a.pdf`],
    ['another port', `https://cdn.kleros.link:8443/ipfs/${CID}/a.pdf`],
    ['a path outside /ipfs/', 'https://cdn.kleros.link/api/upload'],
    ['an IPNS path', `https://cdn.kleros.link/ipns/${CID}`],
    ['a climb out of /ipfs/', 'https://cdn.kleros.link/ipfs/../api/x'],
    ['an encoded climb', 'https://cdn.kleros.link/ipfs/%2e%2e/api/x'],
    ['a relative path', `/ipfs/${CID}/a.pdf`],
    ['a protocol-relative link', `//cdn.kleros.link/ipfs/${CID}/a.pdf`],
    ['a script', 'javascript:alert(1)'],
    ['an empty value', ''],
    ['nothing', undefined],
  ])('refuses %s', (_, url) => {
    expect(getAllowedAttachmentUrl(url)).toBeUndefined()
  })

  it('allows nothing when no gateway is configured', async () => {
    vi.stubEnv('REACT_APP_IPFS_GATEWAY', '')
    vi.resetModules()
    const { getAllowedAttachmentUrl: allowed } =
      await import('./url-validation')
    expect(allowed(ON_GATEWAY)).toBeUndefined()
  })
})
