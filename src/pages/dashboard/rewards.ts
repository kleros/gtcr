import { useQuery } from '@tanstack/react-query'
import snapshot from 'config/curate-rewards-snapshot.json'

/*
 * The PNK Kleros pays curators of its own lists (the Scout review's
 * rewards, option E, which Fortunato greenlit "with the total numbers"):
 * the totals sit in Open for verification's footnotes, linked to
 * rewards.kleros.io/curate, which is always up to date and shows what every
 * curator earned, month by month.
 *
 * Read from that page's own files: rewards.kleros.io/curate-rewards.json
 * lists one file per month on IPFS, each with its total and its recipients.
 * A listed file never changes, so the months that existed when this release
 * was built ship with it (config/curate-rewards-snapshot.json, written by
 * scripts/curate-rewards-snapshot.mjs); a visit reads the index (about 2 KB)
 * and only the months published since. Nothing here names a list: what the
 * programme covers is the rewards page's to say.
 */

export const REWARDS_PAGE = 'https://rewards.kleros.io/curate'
/** Where a list asks Kleros about rewards of its own (the help menu's group). */
export const REWARDS_ASK = 'https://t.me/KlerosCurate'

export interface RewardsMonth {
  /** "2026-10" */
  period: string
  /** The chain the month's rewards were paid for. */
  chainId: number
  url: string
  /** PNK paid that month, in wei, as a decimal string. */
  total: string
  /** The addresses paid that month, lowercase. */
  recipients: string[]
}

export interface RewardsTotals {
  /** PNK paid, in wei, as a decimal string. */
  total: string
  /** Different addresses paid. */
  curators: number
  /** The first and the latest month counted, "2022-04". */
  from: string
  through: string
  /** The chains the rewards were paid for: the board shows them in scope. */
  chainIds: number[]
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const PERIOD = /^\d{4}-\d{2}$/
const WEI = /^\d+$/
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * A month's period, chain, total and the addresses paid, or null when the
 * file is not a curate-rewards/v1 month. scripts/curate-rewards-snapshot.mjs
 * reads files the same way (rewards.test.ts holds the two to the same
 * answers).
 */
export const monthFromFile = (url: string, file: any): RewardsMonth | null => {
  if (file?.schema !== 'curate-rewards/v1') return null
  const period = file.period?.label
  const total = file.totals?.total
  const chainId = file.chainId
  if (typeof period !== 'string' || !PERIOD.test(period)) return null
  if (typeof total !== 'string' || !WEI.test(total)) return null
  if (!Number.isInteger(chainId) || chainId <= 0) return null
  const recipients =
    file.recipients &&
    typeof file.recipients === 'object' &&
    !Array.isArray(file.recipients)
      ? Object.keys(file.recipients)
          .filter((key) => ADDRESS.test(key))
          .map((key) => key.toLowerCase())
      : []
  return { period, chainId, url, total, recipients }
}

/**
 * The months' total, the addresses they paid (each once), the months
 * spanned and the chains paid for.
 */
export const rewardsTotals = (
  months: RewardsMonth[],
): RewardsTotals | undefined => {
  if (months.length === 0) return undefined
  const periods = months.map((month) => month.period).sort(byCodeUnit)
  return {
    total: months
      .reduce((sum, month) => sum + BigInt(month.total), 0n)
      .toString(),
    curators: new Set(months.flatMap((month) => month.recipients)).size,
    from: periods[0],
    through: periods[periods.length - 1],
    chainIds: [...new Set(months.map((month) => month.chainId))],
  }
}

/** The months that shipped with this release, their recipients by address. */
const SNAPSHOT_MONTHS: RewardsMonth[] = snapshot.months.map(
  ({ paid, ...month }) => ({
    ...month,
    recipients: paid.map((place) => snapshot.curators[place]),
  }),
)

/** What shipped with this release. */
export const SNAPSHOT_TOTALS = rewardsTotals(SNAPSHOT_MONTHS)

/**
 * Months listed since the snapshot that are read in full (each file runs to
 * a few hundred KB). Past this the release is old: its totals stand, as of
 * their last month, rather than the page reading a year of files.
 */
const MAX_NEW_MONTHS = 3

const readJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

/**
 * The snapshot with any month published since. A month listed again under
 * a new file (a correction) replaces the snapshot's month of that period,
 * its recipients with it.
 */
export const fetchCurateRewards = async (
  read: (url: string) => Promise<unknown> = readJson,
): Promise<RewardsTotals | undefined> => {
  const index = await read(snapshot.index)
  if (!Array.isArray(index)) throw new Error('The rewards index is not a list')
  const known = new Set(SNAPSHOT_MONTHS.map((month) => month.url))
  const fresh = index.filter(
    (url): url is string => typeof url === 'string' && !known.has(url),
  )
  if (fresh.length === 0 || fresh.length > MAX_NEW_MONTHS)
    return SNAPSHOT_TOTALS
  const byPeriod = new Map(
    SNAPSHOT_MONTHS.map((month) => [month.period, month] as const),
  )
  const reads = await Promise.all(
    fresh.map(async (url) => monthFromFile(url, await read(url))),
  )
  reads.forEach((month) => {
    if (month) byPeriod.set(month.period, month)
  })
  return rewardsTotals([...byPeriod.values()])
}

/**
 * The totals for the footnote: the snapshot's at once, then with any newer
 * month once the index answers. A failed read leaves the snapshot's.
 */
export const useCurateRewards = (): RewardsTotals | undefined => {
  const { data } = useQuery({
    queryKey: ['curateRewards'],
    queryFn: () => fetchCurateRewards(),
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  })
  return data ?? SNAPSHOT_TOTALS
}

const compactPnk = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumSignificantDigits: 3,
})

/** "13.7M": PNK from wei, compact, as the hero's totals are. */
export const formatPnk = (wei: string): string =>
  compactPnk.format(Number(BigInt(wei) / 10n ** 15n) / 1000)

/** "October 2026" from "2026-10". */
export const monthName = (period: string): string => {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
