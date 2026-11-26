import type { QueryClient } from '@tanstack/react-query'
import {
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
} from 'viem'
import { formatDurationLong } from 'utils/time'
import { readExtraData } from 'utils/string'
import {
  AMBIGUOUS_COMMA,
  isAmbiguousComma,
  normalizeDecimalInput,
} from 'utils/decimal-input'
import type { GovernanceParams } from './data'

/*
 * The governance dialog's rules (governance.tsx), apart from the dialog so
 * they are tested without it: how a parameter is shown and read back, the
 * arbitrator extra data a court or MetaEvidence save sends, what the
 * transfer warning says of the new governor's code, and which reads other
 * pages keep of a list a save makes stale.
 */

/* ---------- Parameter plumbing ---------- */

/*
 * Every value is shown in the unit people think in (the chain's coin, the
 * stake token, days, percent) and written in the unit the contract stores
 * (wei, the token's base units, seconds, basis points). Parsing is strict: no
 * grouping, no exponent, no more decimals than the unit has, and an empty
 * field is never read as 0.
 */

export type ParamKind = 'wei' | 'token' | 'seconds' | 'multiplier' | 'address'
type ParamKey = keyof GovernanceParams

/**
 * The dialog's sections after Court, which holds the arbitration field: one
 * screen each, so the dialog never grows past the window.
 */
export type ParamGroup = 'deposits' | 'timing' | 'advanced'

export interface ParamConfig {
  key: ParamKey
  label: string
  kind: ParamKind
  functionName: string
  group: ParamGroup
  /** What the parameter does, one sentence, behind the label's "?". */
  help: string
  /**
   * A line kept in view under the field. Only for what cannot be undone,
   * which nobody should have to hover to find out.
   */
  note?: string
  /** A period that must stay above zero (0 would skip a protection window). */
  positive?: boolean
}

/** What the dialog reads beyond the registry row. */
export interface ParamContext {
  /** The Stake Curate token's decimals; undefined until read (or unreadable). */
  tokenDecimals?: number
}

const DAY_SECONDS = 86_400
/** MULTIPLIER_DIVISOR is 10000 on every Curate contract, so 100% = 10000. */
const BPS_PER_PERCENT = 100
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/

/** A fixed-point string without grouping or exponent, trailing zeros trimmed. */
const plainDecimal = (value: number, maxDecimals: number) => {
  const fixed = value.toFixed(maxDecimals)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

const decimalsIn = (text: string) => text.split('.')[1]?.length ?? 0

export const formatParamValue = (
  value: string | undefined,
  kind: ParamKind,
  context: ParamContext,
): string => {
  if (value === undefined || value === '') return ''
  try {
    if (kind === 'wei') return formatEther(BigInt(value))
    if (kind === 'token')
      return context.tokenDecimals === undefined
        ? ''
        : formatUnits(BigInt(value), context.tokenDecimals)
    // Six decimals of a day is under a tenth of a second, so whole seconds
    // survive the round trip exactly.
    if (kind === 'seconds') return plainDecimal(Number(value) / DAY_SECONDS, 6)
    if (kind === 'multiplier')
      return plainDecimal(Number(value) / BPS_PER_PERCENT, 2)
  } catch {
    return value
  }
  return value
}

export type Parsed =
  | { value: bigint | string; error?: undefined }
  | { value?: undefined; error: string }

export const parseParamValue = (
  raw: string,
  config: ParamConfig,
  context: ParamContext,
): Parsed => {
  // An amount may use a comma for the decimal point (0,5 reads as 0.5);
  // "1,000" stays as typed, so the plain-decimal check below refuses it.
  const text =
    config.kind === 'address' ? raw.trim() : normalizeDecimalInput(raw)
  if (config.kind === 'address')
    return isAddress(text)
      ? { value: text }
      : { error: 'Enter a valid address' }
  if (text === '') return { error: 'Enter a value' }
  if (!PLAIN_DECIMAL.test(text))
    return {
      error: isAmbiguousComma(raw)
        ? AMBIGUOUS_COMMA
        : 'Use digits and one dot or comma, like 0.5',
    }
  if (config.kind === 'wei') {
    if (decimalsIn(text) > 18) return { error: 'At most 18 decimals' }
    return { value: parseEther(text) }
  }
  if (config.kind === 'token') {
    const decimals = context.tokenDecimals
    if (decimals === undefined)
      return { error: "The token's decimals could not be read" }
    if (decimalsIn(text) > decimals)
      return { error: `At most ${decimals} decimals for this token` }
    return { value: parseUnits(text, decimals) }
  }
  // Days and percents are converted as JavaScript numbers, exact only up to
  // 2^53. Past that the value sent drifts from the value typed, and past
  // about 10^303 days (10^306 %) it is Infinity, which BigInt throws on
  // while the field renders. No period or stake is anywhere near either.
  if (config.kind === 'seconds') {
    const seconds = Math.round(Number(text) * DAY_SECONDS)
    if (!Number.isSafeInteger(seconds)) return { error: 'Too long' }
    if (config.positive && seconds <= 0)
      return { error: 'Must be longer than 0' }
    return { value: BigInt(seconds) }
  }
  if (decimalsIn(text) > 2) return { error: 'At most 2 decimals' }
  const basisPoints = Math.round(Number(text) * BPS_PER_PERCENT)
  if (!Number.isSafeInteger(basisPoints)) return { error: 'Too large' }
  return { value: BigInt(basisPoints) }
}

/** True when the typed value equals what the contract holds now. */
export const isUnchanged = (
  parsed: Parsed,
  current: string | undefined,
  kind: ParamKind,
) => {
  if (parsed.error !== undefined || current === undefined) return false
  if (kind === 'address')
    return String(parsed.value).toLowerCase() === current.toLowerCase()
  try {
    return BigInt(current) === parsed.value
  } catch {
    return false
  }
}

/* ---------- The review before anything is signed ---------- */

/** The unit a parameter is stored in, named in the review's raw figures. */
const STORED_UNIT: Record<Exclude<ParamKind, 'address'>, string> = {
  wei: 'wei',
  token: 'base units',
  seconds: 's',
  multiplier: 'basis points',
}

/** A value as the review shows it: in people's unit, and as stored. */
export interface ReviewValue {
  shown: string
  /** As the contract stores it, unit named; undefined for an address. */
  stored?: string
}

/**
 * A stored value for the review: the coin or token amount with its symbol,
 * a period in words, a percent; then the integer the contract keeps. An
 * address is shown whole. Undefined when there is no value to show.
 */
export const reviewValue = (
  stored: string | bigint | undefined,
  kind: ParamKind,
  context: ParamContext,
  /** The coin's or token's symbol, for 'wei' and 'token'. */
  symbol?: string,
): ReviewValue | undefined => {
  if (stored === undefined || stored === '') return undefined
  const text = String(stored)
  if (kind === 'address') return { shown: text }
  let integer: bigint
  try {
    integer = BigInt(text)
  } catch {
    return { shown: text }
  }
  const raw = `${integer.toLocaleString('en-US')} ${STORED_UNIT[kind]}`
  if (kind === 'seconds')
    return { shown: formatDurationLong(Number(integer)), stored: raw }
  const amount = formatParamValue(text, kind, context)
  if (kind === 'multiplier') return { shown: `${amount}%`, stored: raw }
  return {
    shown: amount === '' ? raw : `${amount}${symbol ? ` ${symbol}` : ''}`,
    stored: raw,
  }
}

/**
 * What a change does to what is already under way, read from the contracts
 * (kleros/tcr LightGeneralizedTCR, kleros/pgtcr PermanentGTCR): a setting
 * read when a request is made touches only new ones, a setting read later
 * (at a challenge, an appeal, an execution) reaches those already open.
 */
export const paramEffect = (key: ParamKey): string => {
  switch (key) {
    case 'submissionBaseDeposit':
      return 'Applies to submissions made from now on; requests already made keep what they paid.'
    case 'removalBaseDeposit':
      return 'Applies to removal requests made from now on; requests already made keep what they paid.'
    case 'submissionChallengeBaseDeposit':
      return 'Applies to every challenge from now on, including challenges to submissions already waiting.'
    case 'removalChallengeBaseDeposit':
      return 'Applies to every challenge from now on, including challenges to removal requests already waiting.'
    case 'challengePeriodDuration':
      return 'Applies at once to requests already waiting: a shorter period ends their challenge window and lets those past it be accepted now; a longer one reopens it for any not accepted yet.'
    case 'winnerStakeMultiplier':
    case 'loserStakeMultiplier':
    case 'sharedStakeMultiplier':
      return 'Applies to appeal funding from now on, including disputes already open.'
    case 'relayerContract':
      return 'Once it takes effect, that contract can add and remove entries directly, with no deposit and no challenge period.'
    case 'connectedTCR':
      return 'Badges are retired: nothing in Curate reads this setting.'
    case 'governor':
      return 'Once it takes effect, only that address can change the list.'
    case 'submissionMinDeposit':
      return 'Applies to submissions from now on; entries already listed keep their stake.'
    case 'challengeStakeMultiplier':
      return 'Applies to every challenge from now on, including challenges to entries already listed.'
    case 'submissionPeriod':
      return 'The contract never reads it: Curate shows a new entry as accepted once it has been listed this long, entries already waiting included.'
    case 'reinclusionPeriod':
      return 'The contract never reads it: Curate shows an entry the jurors kept as accepted again once it has been back this long, entries already back included.'
    case 'withdrawingPeriod':
      return 'Applies at once to entries already withdrawing: their stake can be taken back, and they can no longer be challenged, once this long has passed since they started.'
    default:
      return 'Applies from now on.'
  }
}

/** What a court or policy change does, on each kind of list. */
export const arbitrationEffect = (
  listKind: 'standard' | 'permanent',
  /** A Stake list's cooldown, in seconds, once read. */
  cooldown?: number,
): string =>
  listKind === 'standard'
    ? 'Requests made from then on use the new court and policy; requests already made, and their disputes, keep theirs.'
    : `New entries use the new court and policy at once. Entries already listed move to them once ${
        cooldown === undefined
          ? "the list's cooldown"
          : cooldown === 0
            ? 'it takes effect (this list has no cooldown)'
            : `the list's cooldown (${formatDurationLong(cooldown)})`
      } has passed since the change; an entry withdrawing keeps the settings of when it started, and disputes already open keep theirs.`

/* ---------- Columns a new MetaEvidence keeps ---------- */

type Column = { label?: unknown; type?: unknown }

const columnPairs = (columns: Column[] | undefined) =>
  (columns ?? []).map((column) => [String(column.label), String(column.type)])

/**
 * How a new MetaEvidence file's columns relate to the live ones: the same,
 * the same with more after them, or changed. List pages pair an entry's
 * values with the columns by position, so a column added at the end leaves
 * every entry as it was (the Kleros Tokens list added "Website" so in April
 * 2025), while one renamed, retyped, moved or removed garbles them all.
 */
export const columnsChange = (
  next: Column[] | undefined,
  live: Column[] | undefined,
): 'same' | 'appended' | 'changed' => {
  const [after, before] = [columnPairs(next), columnPairs(live)]
  if (after.length < before.length) return 'changed'
  const kept = before.every(
    ([label, type], index) =>
      after[index][0] === label && after[index][1] === type,
  )
  if (!kept) return 'changed'
  return after.length === before.length ? 'same' : 'appended'
}

/* ---------- The new governor ---------- */

/** What the chain says a new governor is, on the list's chain. */
export type GovernorTarget =
  | { kind: 'wallet' }
  | { kind: 'safe'; threshold: number; owners: number }
  | { kind: 'list' }
  | { kind: 'contract' }
  | { kind: 'unknown' }

/**
 * What the review says of a new governor, and whether the transfer is
 * refused. A list (anything with its own governor and arbitrator) never
 * sends a call, so handing a list to one freezes it; any other contract
 * that is not a Safe is allowed with a warning, since a governance contract
 * can act but a token or a registry cannot, and the chain cannot tell them
 * apart. Two Gnosis lists name the Ethereum Kleros Governor, which has no
 * code on Gnosis: the wallet note says a Safe must exist on the chain itself.
 */
export const governorTargetNote = (
  target: GovernorTarget,
  chain: string,
): { refusal?: string; note: string; warning?: boolean } => {
  switch (target.kind) {
    case 'wallet':
      return {
        note: `No contract at that address on ${chain}: fine for a personal wallet, but a Safe or another governance contract must exist on ${chain} itself, or nobody can ever change the list again.`,
      }
    case 'safe':
      return {
        note: `A Safe on ${chain}: ${target.threshold} of its ${target.owners} owners sign each change.`,
      }
    case 'list':
      return {
        refusal:
          'That address is a list (it has its own governor and arbitrator), and a list never sends transactions: nobody could change this list again.',
        note: '',
      }
    case 'contract':
      return {
        note: `That address is a contract on ${chain}, but not a Safe. Only go on if it is a governance contract that can call this list; a token, a registry or another app's contract cannot, and nobody could ever change the list again.`,
        warning: true,
      }
    default:
      return {
        note: `What is at that address on ${chain} could not be checked. Only go on if you are sure it is a wallet or a Safe on ${chain}.`,
        warning: true,
      }
  }
}

/** The typed value in the stored unit, so nothing is a surprise on chain. */
export const describeParsed = (parsed: Parsed, kind: ParamKind) => {
  if (parsed.error !== undefined) return undefined
  if (kind === 'seconds') {
    const seconds = Number(parsed.value)
    return `${formatDurationLong(seconds)} (${seconds.toLocaleString('en-US')} s)`
  }
  if (kind === 'multiplier')
    return `Stored as ${Number(parsed.value).toLocaleString('en-US')} basis points (10,000 = 100%)`
  return undefined
}

/* ---------- The court a save sends ---------- */

export const buildArbitratorExtraData = (courtID: number, jurors: number) =>
  `0x${courtID.toString(16).padStart(64, '0')}${jurors
    .toString(16)
    .padStart(64, '0')}`

/** Juror count as typed: a whole, odd number from 1 to 33. */
export const parseJurors = (
  text: string,
): { value?: number; error?: string } => {
  if (!/^\d+$/.test(text.trim())) return { error: 'Enter a whole number' }
  const value = Number(text)
  if (value < 1 || value > 33) return { error: 'Between 1 and 33 jurors' }
  if (value % 2 === 0)
    return { error: 'Use an odd number, so votes cannot tie' }
  return { value }
}

/**
 * The arbitrator extra data a court and MetaEvidence save sends, or what
 * stops it. Both contracts store the extra data again with every
 * MetaEvidence change (changeArbitrationParams), so a save that leaves the
 * arbitrator, the court and the jurors alone sends the list's own bytes
 * back exactly as the chain holds them. Built from the court fields
 * instead, a policy-only save would rewrite the arbitration settings of a
 * list whose extra data is not a Kleros court and juror count (another
 * arbitrator's layout, words past those two, a count the fields refuse),
 * or ask for a court it never had.
 */
export const arbitrationExtraData = ({
  current,
  courtID,
  jurors,
  courtEdited,
  arbitratorChanged,
}: {
  /** The list's extra data now, as the chain returned it. */
  current: string
  /** The court as selected; empty when none is. */
  courtID: string
  /** The number of jurors as typed. */
  jurors: string
  /** The governor has changed the court or the jurors. */
  courtEdited: boolean
  /** The governor has changed the arbitrator (Standard Curate only). */
  arbitratorChanged: boolean
}):
  | { value: string; error?: undefined }
  | { value?: undefined; error: string } => {
  const courtNumber = /^\d+$/.test(courtID) ? Number(courtID) : undefined
  // A court and count put back to the list's own are no change, even a
  // count the fields would refuse (an even one).
  const held = readExtraData(current)
  const keepsCourt =
    !courtEdited ||
    (held !== null &&
      courtNumber === held.courtID &&
      /^\d+$/.test(jurors.trim()) &&
      Number(jurors) === held.numberOfJurors)
  if (!arbitratorChanged && keepsCourt) return { value: current }
  if (courtNumber === undefined) return { error: 'Choose a court' }
  const jurorCount = parseJurors(jurors)
  if (jurorCount.value === undefined)
    return { error: `Jurors: ${jurorCount.error}` }
  return { value: buildArbitratorExtraData(courtNumber, jurorCount.value) }
}

/* ---------- After a save ---------- */

/*
 * The reads other pages keep of a list's MetaEvidence (its policy, columns
 * and name) and governance settings, which RefreshAfterTransactions leaves
 * alone since an entry's transaction never changes them: the list page's
 * MetaEvidence and the same file as other pages show it (fresh for a day),
 * and the settings behind the list page's "Update list parameters" (a
 * minute). Matched by the list's chain and address, in any case, wherever
 * the key holds them. The deposits, the policy history and a Stake list's
 * settings are RefreshAfterTransactions' to read again.
 */
const LIST_SETTINGS_READS = new Set([
  'metaEvidence',
  'tcrMetaEvidence',
  'listGovernance',
])

const readsListSettings = (
  queryKey: readonly unknown[],
  list: { chainId: number; address: string },
) =>
  LIST_SETTINGS_READS.has(String(queryKey[0])) &&
  queryKey.includes(list.chainId) &&
  queryKey.some(
    (part) =>
      typeof part === 'string' &&
      part.toLowerCase() === list.address.toLowerCase(),
  )

/**
 * After a mined save, those reads are marked stale, so the next page to
 * show the list reads them again instead of the cached file from before
 * the change. Nothing is fetched now: a page on screen (the list's own,
 * when the dialog opened there) reads them again itself.
 */
export const markListSettingsStale = (
  queryClient: QueryClient,
  list: { chainId: number; address: string },
) =>
  queryClient.invalidateQueries({
    predicate: ({ queryKey }) => readsListSettings(queryKey, list),
    refetchType: 'none',
  })
