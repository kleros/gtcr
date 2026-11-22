import { describe, expect, it } from 'vitest'
import objectWithoutKey from './object-without-key'

describe('objectWithoutKey', () => {
  it('returns the object without the key', () => {
    expect(objectWithoutKey({ a: 1, b: 2, c: 3 }, 'b')).toEqual({ a: 1, c: 3 })
  })

  it('leaves the object it was given untouched', () => {
    const types = {
      TEXT: 'text',
      TWITTER_USER_ID: 'twitter',
      ADDRESS: 'address',
    }
    objectWithoutKey(types, 'TWITTER_USER_ID')
    expect(types).toEqual({
      TEXT: 'text',
      TWITTER_USER_ID: 'twitter',
      ADDRESS: 'address',
    })
  })

  it('returns a copy with every entry when the key is not there', () => {
    const object = { a: 1, b: 2 }
    const result = objectWithoutKey(object, 'z')
    expect(result).toEqual(object)
    expect(result).not.toBe(object)
  })

  it('keeps the other keys whatever their values', () => {
    const result = objectWithoutKey({ a: 0, b: undefined, c: '', d: 1 }, 'd')
    expect(Object.keys(result)).toEqual(['a', 'b', 'c'])
  })
})
