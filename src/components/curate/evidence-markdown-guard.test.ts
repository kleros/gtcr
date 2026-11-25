import { describe, expect, it } from 'vitest'
import {
  MARKDOWN_MAX_DEPTH,
  MARKDOWN_MAX_INDENT,
  MARKDOWN_MAX_LENGTH,
  MARKDOWN_MAX_LINES,
  MARKDOWN_MAX_MARKERS,
  MARKDOWN_MAX_SIGNS,
  containerDepth,
  indentOf,
  rendersAsMarkdown,
} from './evidence-markdown-guard'

describe('rendersAsMarkdown', () => {
  it('leaves text without Markdown plain', () => {
    expect(
      rendersAsMarkdown('Domain no longer functional.\nhttps://example.com'),
    ).toBe(false)
    expect(
      rendersAsMarkdown('Item #1 is a duplicate - see rule 4 of the policy.'),
    ).toBe(false)
  })

  it('renders emphasis, code, links and markers opening a line', () => {
    for (const text of [
      'the public name tag *must* differentiate them',
      'Run `acme upload <file>` first',
      'Source: [ERC-20](https://eips.ethereum.org/EIPS/eip-20)',
      '1. Safe holds no assets',
      '- first point',
      '> quoted from the policy',
      '## Clipped',
    ])
      expect(rendersAsMarkdown(text)).toBe(true)
  })

  it('keeps text past the size limits plain', () => {
    const fill = 'x'.repeat(MARKDOWN_MAX_LENGTH - '*a* '.length)
    expect(rendersAsMarkdown(`*a* ${fill}`)).toBe(true)
    expect(rendersAsMarkdown(`*a* ${fill}x`)).toBe(false)
    expect(rendersAsMarkdown('*a'.repeat(MARKDOWN_MAX_SIGNS))).toBe(true)
    expect(rendersAsMarkdown('*a'.repeat(MARKDOWN_MAX_SIGNS + 1))).toBe(false)
    // A trailing line break opens one more (empty) line.
    const lines = (count: number) => `*a*\n${'x\n'.repeat(count - 2)}`
    expect(rendersAsMarkdown(lines(MARKDOWN_MAX_LINES))).toBe(true)
    expect(rendersAsMarkdown(lines(MARKDOWN_MAX_LINES + 1))).toBe(false)
    expect(rendersAsMarkdown('- a\n'.repeat(MARKDOWN_MAX_MARKERS))).toBe(true)
    expect(rendersAsMarkdown('- a\n'.repeat(MARKDOWN_MAX_MARKERS + 1))).toBe(
      false,
    )
  })

  it('keeps text indented deeper than any real evidence plain', () => {
    expect(indentOf('\t  \tx')).toBe(8)
    expect(
      rendersAsMarkdown(`*a*\n${' '.repeat(MARKDOWN_MAX_INDENT)}- x`),
    ).toBe(true)
    expect(
      rendersAsMarkdown(`*a*\n${' '.repeat(MARKDOWN_MAX_INDENT + 1)}- x`),
    ).toBe(false)
  })

  it('keeps deep nesting plain, which would overflow the stack', () => {
    expect(rendersAsMarkdown(`${'- '.repeat(MARKDOWN_MAX_DEPTH)}a`)).toBe(true)
    expect(rendersAsMarkdown(`${'- '.repeat(MARKDOWN_MAX_DEPTH + 1)}a`)).toBe(
      false,
    )
    expect(rendersAsMarkdown(`*Fine*\n${'>'.repeat(300)} a`)).toBe(false)
    expect(rendersAsMarkdown(`${'1. '.repeat(40)}a`)).toBe(false)
  })
})

describe('containerDepth', () => {
  it('counts each quote and list marker opening a line', () => {
    expect(containerDepth('plain text')).toBe(0)
    expect(containerDepth('>>> http://ethos.network/')).toBe(3)
    expect(containerDepth('  - > 1. text')).toBe(3)
    expect(containerDepth('2024. was a year')).toBe(1)
  })

  it('counts an empty item, which opens its level all the same', () => {
    expect(containerDepth('-')).toBe(1)
    expect(containerDepth('\t\t-')).toBe(1)
    expect(containerDepth('1.')).toBe(1)
    const staircase = Array.from(
      { length: 130 },
      (_, depth) => `${'\t'.repeat(depth)}-`,
    ).join('\n')
    expect(rendersAsMarkdown(`*a*\n${staircase}`)).toBe(false)
  })

  it('counts only real markers', () => {
    expect(containerDepth('-not a marker')).toBe(0)
    expect(containerDepth('*emphasis*')).toBe(0)
    expect(containerDepth('1234567890. ten digits')).toBe(0)
  })
})
