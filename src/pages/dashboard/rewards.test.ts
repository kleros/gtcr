import { describe, expect, it } from 'vitest'
import snapshot from 'config/curate-rewards-snapshot.json'
import { monthFromFile as scriptMonthFromFile } from '../../../scripts/curate-rewards-snapshot.mjs'
import {
  SNAPSHOT_TOTALS,
  fetchCurateRewards,
  formatPnk,
  monthFromFile,
  monthName,
  rewardsTotals,
  type RewardsMonth,
} from './rewards'

const PNK = 10n ** 18n
const A = `0x${'a'.repeat(40)}`
const B = `0x${'B'.repeat(40)}`
const URLS = snapshot.months.map((month) => month.url)

const file = (period: string, total: bigint, recipients: string[]) => ({
  schema: 'curate-rewards/v1',
  chainId: 100,
  period: { label: period, start: '', end: '' },
  token: { symbol: 'PNK' },
  totals: { total: total.toString(), recipientCount: recipients.length },
  recipients: Object.fromEntries(
    recipients.map((address) => [address, { total: '1' }]),
  ),
})

const month = (
  period: string,
  total: bigint,
  recipients: string[],
  chainId = 100,
): RewardsMonth => ({
  period,
  chainId,
  url: `https://cdn/${period}.json`,
  total: total.toString(),
  recipients,
})

describe('monthFromFile', () => {
  it('reads a month’s period, chain, total and the addresses paid', () => {
    expect(
      monthFromFile(
        'https://x/2026-11.json',
        file('2026-11', 5n * PNK, [A, B]),
      ),
    ).toEqual({
      period: '2026-11',
      chainId: 100,
      url: 'https://x/2026-11.json',
      total: (5n * PNK).toString(),
      recipients: [A, B.toLowerCase()],
    })
  })

  it('refuses a file that is not a curate-rewards/v1 month', () => {
    const good = file('2026-11', 1n, [])
    expect(monthFromFile('u', null)).toBeNull()
    expect(monthFromFile('u', { ...good, schema: 'v2' })).toBeNull()
    expect(monthFromFile('u', { ...good, period: { label: 'Nov' } })).toBeNull()
    expect(monthFromFile('u', { ...good, totals: { total: 12 } })).toBeNull()
    expect(monthFromFile('u', { ...good, chainId: '100' })).toBeNull()
  })

  it('reads files as the snapshot script does', () => {
    const samples = [
      file('2026-11', 7n * PNK, [A, B, 'not an address']),
      { ...file('2026-11', 1n, []), recipients: [] },
      { ...file('2026-11', 1n, []), chainId: undefined },
      { schema: 'other' },
      undefined,
    ]
    samples.forEach((sample) =>
      expect(monthFromFile('u', sample)).toEqual(
        scriptMonthFromFile('u', sample),
      ),
    )
  })
})

describe('rewardsTotals', () => {
  it('adds the months and counts each address once', () => {
    expect(
      rewardsTotals([
        month('2026-10', 2n * PNK, [A, B.toLowerCase()]),
        month('2026-09', 3n * PNK, [A]),
      ]),
    ).toEqual({
      total: (5n * PNK).toString(),
      curators: 2,
      from: '2026-09',
      through: '2026-10',
      chainIds: [100],
    })
    expect(rewardsTotals([])).toBeUndefined()
  })

  it('ships with every published month and every address paid', () => {
    expect(SNAPSHOT_TOTALS?.from).toBe(snapshot.months[0].period)
    expect(SNAPSHOT_TOTALS?.through).toBe(snapshot.months.at(-1)?.period)
    expect(SNAPSHOT_TOTALS?.curators).toBe(snapshot.curators.length)
    expect(SNAPSHOT_TOTALS?.chainIds).toEqual([100])
  })
})

describe('fetchCurateRewards', () => {
  it('keeps the snapshot when the index lists nothing new', async () => {
    const read = async (url: string) => {
      if (url === snapshot.index) return URLS
      throw new Error(`unexpected read of ${url}`)
    }
    expect(await fetchCurateRewards(read)).toEqual(SNAPSHOT_TOTALS)
  })

  it('adds a month published since, and its new curators', async () => {
    const NEW = 'https://cdn/ipfs/QmNew/curate-rewards-2026-11.json'
    const read = async (url: string) =>
      url === snapshot.index
        ? [...URLS, NEW]
        : file('2026-11', 10n * PNK, [A, snapshot.curators[0]])
    const totals = await fetchCurateRewards(read)
    expect(totals?.through).toBe('2026-11')
    expect(totals?.curators).toBe(snapshot.curators.length + 1)
    expect(BigInt(totals!.total) - BigInt(SNAPSHOT_TOTALS!.total)).toBe(
      10n * PNK,
    )
  })

  it('replaces a month listed again under a new file, recipients too', async () => {
    const last = snapshot.months.at(-1)!
    // Someone paid only in the last month, whom the correction leaves out.
    const onlyThen = last.paid
      .map((place) => snapshot.curators[place])
      .find(
        (address) =>
          !snapshot.months
            .slice(0, -1)
            .some((other) =>
              other.paid.some((place) => snapshot.curators[place] === address),
            ),
      )
    const kept = last.paid
      .map((place) => snapshot.curators[place])
      .filter((address) => address !== onlyThen)
    const FIXED = `https://cdn/ipfs/QmFixed/curate-rewards-${last.period}.json`
    const read = async (url: string) =>
      url === snapshot.index
        ? [...URLS.slice(0, -1), FIXED]
        : file(last.period, BigInt(last.total) + PNK, kept)
    const totals = await fetchCurateRewards(read)
    expect(BigInt(totals!.total) - BigInt(SNAPSHOT_TOTALS!.total)).toBe(PNK)
    expect(totals?.through).toBe(last.period)
    expect(totals?.curators).toBe(snapshot.curators.length - (onlyThen ? 1 : 0))
  })

  it('keeps the snapshot for an old release rather than read a year of files', async () => {
    const many = Array.from({ length: 4 }, (_, i) => `https://cdn/${i}.json`)
    const read = async (url: string) => {
      if (url === snapshot.index) return [...URLS, ...many]
      throw new Error(`unexpected read of ${url}`)
    }
    expect(await fetchCurateRewards(read)).toEqual(SNAPSHOT_TOTALS)
  })

  it('fails when the index is not a list (the hook keeps the snapshot)', async () => {
    await expect(fetchCurateRewards(async () => ({}))).rejects.toThrow()
  })
})

describe('formatting', () => {
  it('writes PNK compact and months in words', () => {
    expect(formatPnk((13_681_495n * PNK).toString())).toBe('13.7M')
    expect(formatPnk((331_421n * PNK).toString())).toBe('331K')
    expect(monthName('2026-10')).toBe('October 2026')
  })
})
