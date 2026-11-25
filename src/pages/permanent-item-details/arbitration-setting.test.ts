import { describe, expect, it } from 'vitest'
import { challengeSetting, entrySetting } from './arbitration-setting'

/*
 * A list created at 100 (the subgraph keeps the first setting's block time;
 * the contract stores 0), whose governor moved it to another court at 10000
 * and again at 20000, with a 3000 s cooldown.
 */
const FIRST = { name: 'first', timestamp: '100' }
const SECOND = { name: 'second', timestamp: '10000' }
const THIRD = { name: 'third', timestamp: '20000' }
const SETTINGS = [THIRD, SECOND, FIRST]
const COOLDOWN = 3000

const pick = (includedAt: number, at: number, withdrawingAt = 0) =>
  challengeSetting(SETTINGS, {
    includedAt,
    withdrawingAt,
    cooldown: COOLDOWN,
    at,
  })?.name

describe('challengeSetting', () => {
  it.each([
    // Included before the second setting: it applies only after its cooldown.
    ['within the second setting’s cooldown', 5000, 12_000, 'first'],
    ['one second before the cooldown ends', 5000, 12_999, 'first'],
    ['the moment the cooldown ends', 5000, 13_000, 'second'],
    ['after the second cooldown, within the third', 5000, 22_000, 'second'],
    ['long after every cooldown', 5000, 30_000, 'third'],
    // Included after a setting took effect: that setting applies at once.
    ['included at the second setting', 10_000, 10_001, 'second'],
    ['included after the second setting', 11_000, 11_500, 'second'],
    ['included after the third setting', 25_000, 25_001, 'third'],
    ['included before any change', 50, 5000, 'first'],
  ])('a challenge %s', (_, includedAt, at, setting) => {
    expect(pick(includedAt, at)).toBe(setting)
  })

  it.each([
    ['inside the second setting’s cooldown freezes the first', 12_000, 'first'],
    ['after that cooldown freezes the second', 14_000, 'second'],
  ])('a withdrawal started %s', (_, withdrawingAt, setting) => {
    // However late the challenge comes.
    expect(pick(5000, 40_000, withdrawingAt)).toBe(setting)
  })

  it('takes the newest setting at once without a cooldown', () => {
    expect(
      challengeSetting(SETTINGS, {
        includedAt: 5000,
        withdrawingAt: 0,
        cooldown: 0,
        at: 20_000,
      })?.name,
    ).toBe('third')
  })

  it('reads settings in any order, and numeric or missing times', () => {
    const shuffled = [
      SECOND,
      { name: 'first', timestamp: null },
      { name: 'third', timestamp: 20_000 },
    ]
    expect(
      challengeSetting(shuffled, {
        includedAt: 5000,
        withdrawingAt: 0,
        cooldown: COOLDOWN,
        at: 12_000,
      })?.name,
    ).toBe('first')
    // The caller's array is not sorted in place.
    expect(shuffled[0]).toBe(SECOND)
  })

  it('always falls back on the first setting', () => {
    expect(
      challengeSetting([SECOND, FIRST], {
        includedAt: 0,
        withdrawingAt: 0,
        cooldown: 1_000_000,
        at: 10_500,
      }),
    ).toBe(FIRST)
    expect(
      challengeSetting([FIRST], {
        includedAt: 0,
        withdrawingAt: 0,
        cooldown: COOLDOWN,
        at: 0,
      }),
    ).toBe(FIRST)
  })

  it('is undefined without settings', () => {
    const times = { includedAt: 0, withdrawingAt: 0, cooldown: 0, at: 0 }
    expect(challengeSetting([], times)).toBeUndefined()
    expect(challengeSetting(null, times)).toBeUndefined()
    expect(challengeSetting(undefined, times)).toBeUndefined()
  })
})

describe('entrySetting', () => {
  const settingOf = (entry: {
    status: string
    includedAt?: number
    withdrawingAt?: number
    challengedAt?: number
    now: number
  }) =>
    entrySetting(SETTINGS, {
      includedAt: 5000,
      withdrawingAt: 0,
      challengedAt: 0,
      cooldown: COOLDOWN,
      ...entry,
    })?.name

  it('is undefined off the list, where a submission takes the newest', () => {
    expect(settingOf({ status: 'Absent', now: 12_000 })).toBeUndefined()
  })

  it.each([
    ['Submitted', 12_000, 'first'],
    ['Submitted', 13_000, 'second'],
    ['Reincluded', 30_000, 'third'],
  ])(
    'a %s entry answers to what a challenge at %d would use',
    (status, now, setting) => {
      expect(settingOf({ status, now })).toBe(setting)
    },
  )

  it('keeps a running dispute on the setting its challenge used', () => {
    // Challenged inside the second setting's cooldown; judged now, long after.
    expect(
      settingOf({ status: 'Disputed', challengedAt: 12_000, now: 30_000 }),
    ).toBe('first')
  })

  it('counts a withdrawal started before the challenge', () => {
    // The withdrawal froze the setting before the second cooldown ended.
    expect(
      settingOf({
        status: 'Disputed',
        withdrawingAt: 11_000,
        challengedAt: 14_000,
        now: 30_000,
      }),
    ).toBe('first')
  })

  it('ignores a withdrawal started after the challenge', () => {
    expect(
      settingOf({
        status: 'Disputed',
        withdrawingAt: 15_000,
        challengedAt: 14_000,
        now: 30_000,
      }),
    ).toBe('second')
  })

  it('reads a dispute whose challenge time is unknown at the current time', () => {
    expect(
      settingOf({ status: 'Disputed', challengedAt: 0, now: 30_000 }),
    ).toBe('third')
  })
})
