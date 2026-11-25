import { describe, expect, it } from 'vitest'
import { getFormattedPath, ipfsImageUrl, parseIpfs } from './ipfs-parse'

const GATEWAY = 'https://cdn.kleros.link'
const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const CID_V1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'

describe('getFormattedPath', () => {
  it.each([
    [`/ipfs/${CID}/file.json`, `/ipfs/${CID}/file.json`],
    [`ipfs/${CID}/file.json`, `/ipfs/${CID}/file.json`],
    [`ipfs://${CID}/file.json`, `/ipfs/${CID}/file.json`],
    [CID, `/ipfs/${CID}`],
    [CID_V1, `/ipfs/${CID_V1}`],
  ])('reads %s as %s', (input, path) => {
    expect(getFormattedPath(input)).toBe(path)
  })

  it('leaves what is not an IPFS reference as it is', () => {
    expect(getFormattedPath('logo.png')).toBe('logo.png')
    expect(getFormattedPath('https://example.com/a')).toBe(
      'https://example.com/a',
    )
  })
})

describe('parseIpfs', () => {
  it.each([
    [`/ipfs/${CID}/file.json`, `${GATEWAY}/ipfs/${CID}/file.json`],
    [`ipfs/${CID_V1}/a.png`, `${GATEWAY}/ipfs/${CID_V1}/a.png`],
    [`ipfs://${CID}`, `${GATEWAY}/ipfs/${CID}`],
    [CID, `${GATEWAY}/ipfs/${CID}`],
  ])('links %s on the gateway', (input, url) => {
    expect(parseIpfs(input)).toBe(url)
  })

  it.each([
    '.evil.example/x',
    '@evil.example/x',
    '//evil.example/x',
    'https://evil.example/x',
    '\\\\evil.example/x',
    ':443@evil.example/x',
    '?next=https://evil.example',
    '',
  ])('keeps %j on the gateway host', (path) => {
    const url = parseIpfs(path)
    expect(url.startsWith(`${GATEWAY}/`)).toBe(true)
    expect(new URL(url).host).toBe('cdn.kleros.link')
  })
})

describe('ipfsImageUrl', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 5],
    ['an object', { uri: `/ipfs/${CID}` }],
    ['empty', ''],
    ['blank', '   '],
  ])('gives nothing for a value that is %s', (_, value) => {
    expect(ipfsImageUrl(value)).toBeUndefined()
  })

  it.each([
    [`/ipfs/${CID}/logo.png`],
    [`ipfs://${CID}/logo.png`],
    [`ipfs/${CID}/logo.png`],
    [`  /ipfs/${CID}/logo.png  `],
  ])('reads %j from the gateway', (uri) => {
    expect(ipfsImageUrl(uri)).toBe(`${GATEWAY}/ipfs/${CID}/logo.png`)
  })

  it('reads a bare CID from the gateway', () => {
    expect(ipfsImageUrl(CID)).toBe(`${GATEWAY}/ipfs/${CID}`)
  })

  it.each([
    `https://ipfs.io/ipfs/${CID}/logo.png`,
    `http://gateway.pinata.cloud/ipfs/${CID}/logo.png?filename=x.png#top`,
    `https://user:pass@evil.example/ipfs/${CID}/logo.png`,
    `HTTPS://IPFS.IO/ipfs/${CID}/logo.png`,
  ])('reads a link to another IPFS gateway through ours: %s', (uri) => {
    expect(ipfsImageUrl(uri)).toBe(`${GATEWAY}/ipfs/${CID}/logo.png`)
  })

  it.each([
    'https://evil.example/logo.png',
    'http://evil.example/logo.png',
    `https://evil.example/static/ipfs/${CID}/logo.png`,
    `https://evil.example?next=/ipfs/${CID}`,
    `https://evil.example#/ipfs/${CID}`,
    `ftp://evil.example/ipfs/${CID}/logo.png`,
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'blob:https://evil.example/0b5c',
    'mailto:someone@example.com',
  ])('gives nothing for %s, which is no IPFS address', (uri) => {
    expect(ipfsImageUrl(uri)).toBeUndefined()
  })

  it('keeps a protocol-relative link on the gateway, never on its host', () => {
    const url = ipfsImageUrl('//evil.example/logo.png')
    expect(url).toBeDefined()
    expect(new URL(url as string).host).toBe('cdn.kleros.link')
  })

  // Regression: ipfsImageUrl takes the ipfs:// scheme in any case, but
  // getFormattedPath only rewrote a lowercase "ipfs://", so
  // "IPFS://<cid>/logo.png" becomes https://cdn.kleros.link/IPFS://<cid>/…,
  // which the gateway cannot serve: the picture is missing. (It stays on the
  // gateway, so it is not a safety issue.)
  it('reads an uppercase IPFS:// URI from the gateway', () => {
    expect(ipfsImageUrl(`IPFS://${CID}/logo.png`)).toBe(
      `${GATEWAY}/ipfs/${CID}/logo.png`,
    )
  })
})
