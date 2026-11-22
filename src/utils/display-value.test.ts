import { describe, expect, it } from 'vitest'
import { displayableValue } from './display-value'

const RENDERABLE = ['string', 'number', 'boolean', 'undefined']

describe('displayableValue', () => {
  it.each([
    ['text', 'Kleros'],
    ['empty text', ''],
    ['a number', 42],
    ['zero', 0],
    ['false', false],
    ['true', true],
    ['null', null],
    ['undefined', undefined],
  ])('passes %s through as it is', (_, value) => {
    expect(displayableValue(value)).toBe(value)
  })

  it('writes a bigint as its digits', () => {
    expect(displayableValue(12_345_678_901_234_567_890n)).toBe(
      '12345678901234567890',
    )
  })

  it('shows an object or an array as its JSON text', () => {
    expect(displayableValue({ name: 'PNK', decimals: 18 })).toBe(
      '{"name":"PNK","decimals":18}',
    )
    expect(displayableValue([1, 'two', { three: 3 }])).toBe(
      '[1,"two",{"three":3}]',
    )
  })

  it('reads an object with its own "toString" key, which String() cannot', () => {
    // What a hand-made entry file can hold: JSON.parse makes it an own key.
    const value = JSON.parse('{"toString":1,"valueOf":2}')
    expect(() => String(value)).toThrow(TypeError)
    expect(displayableValue(value)).toBe('{"toString":1,"valueOf":2}')
  })

  it('treats a "toJSON" key that is not a function as data', () => {
    expect(displayableValue(JSON.parse('{"toJSON":"x"}'))).toBe(
      '{"toJSON":"x"}',
    )
  })

  it('never throws on what JSON.stringify refuses or cannot write', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const throwingToJSON = {
      toJSON() {
        throw new Error('no')
      },
    }
    expect(displayableValue(circular)).toBe('[object Object]')
    expect(displayableValue({ big: 1n })).toBe('[object Object]')
    expect(displayableValue(throwingToJSON)).toBe('[object Object]')
    expect(displayableValue(() => 1)).toBe('[object Function]')
    expect(displayableValue(Symbol('s'))).toBe('[object Symbol]')
  })

  it('always gives something React can render as text', () => {
    const hostile: unknown[] = [
      JSON.parse('{"toString":{"a":1}}'),
      JSON.parse('{"__proto__":{"polluted":true}}'),
      [[[]]],
      new Date(0),
      Object.create(null),
    ]
    for (const value of hostile) {
      const shown = displayableValue(value)
      expect(RENDERABLE).toContain(typeof shown)
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
