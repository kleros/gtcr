import { describe, expect, it } from 'vitest'
import {
  AMBIGUOUS_COMMA,
  isAmbiguousComma,
  normalizeDecimalInput,
} from './decimal-input'

describe('normalizeDecimalInput', () => {
  it('reads one comma as the decimal point', () => {
    expect(normalizeDecimalInput('0,5')).toBe('0.5')
    expect(normalizeDecimalInput('12,75')).toBe('12.75')
  })

  it('reads a comma that cannot be a thousands group as decimals', () => {
    // A leading 0, or more than three digits before the comma.
    expect(normalizeDecimalInput('0,125')).toBe('0.125')
    expect(normalizeDecimalInput('1234,567')).toBe('1234.567')
  })

  it('leaves a comma that could mean thousands for the caller to refuse', () => {
    expect(normalizeDecimalInput('2,375')).toBe('2,375')
    expect(normalizeDecimalInput('1,000')).toBe('1,000')
  })

  it('leaves dots, several commas and plain numbers as typed', () => {
    expect(normalizeDecimalInput('1.5')).toBe('1.5')
    expect(normalizeDecimalInput('1,000.5')).toBe('1,000.5')
    expect(normalizeDecimalInput('1,000,000')).toBe('1,000,000')
    expect(normalizeDecimalInput('42')).toBe('42')
  })

  it('drops surrounding spaces', () => {
    expect(normalizeDecimalInput('  0,5 ')).toBe('0.5')
    expect(normalizeDecimalInput(' 3 ')).toBe('3')
  })
})

describe('isAmbiguousComma', () => {
  it('flags one to three digits, a comma and three digits', () => {
    expect(isAmbiguousComma('2,375')).toBe(true)
    expect(isAmbiguousComma('999,000')).toBe(true)
    expect(isAmbiguousComma(' -1,250 ')).toBe(true)
  })

  it('does not flag what can only be a decimal', () => {
    expect(isAmbiguousComma('0,125')).toBe(false)
    expect(isAmbiguousComma('1,25')).toBe(false)
    expect(isAmbiguousComma('1234,567')).toBe(false)
    expect(isAmbiguousComma('1,2345')).toBe(false)
  })

  it('says why the amount is refused', () => {
    expect(AMBIGUOUS_COMMA).toMatch(/thousands/)
  })
})
