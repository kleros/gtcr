import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPublicClient, readContracts, simulateContract } from '@wagmi/core'
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import {
  erc20Abi,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  zeroAddress,
} from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import EnsureAuth from 'components/ensure-auth'
import Select from 'components/ui/Select'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonAnchor,
  ButtonLink,
  ChainChip,
  Chip,
  Data,
  IconButton,
  Label,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  StatusDot,
  Subheading,
  TextInput,
  truncateMiddle,
} from 'components/curate/primitives'
import { getNativeCurrency } from 'config/chains'
import {
  klerosAddresses,
  subgraphUrl,
  subgraphUrlPermanent,
} from 'config/tcr-addresses'
import { appKitModal, wagmiConfig } from 'config/wagmi'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useCourtPolicies from 'hooks/use-court-policies'
import { formatDate, formatDurationLong } from 'utils/time'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { fetchRegistryCreationTimes } from 'utils/registry-creation'
import { parseIpfs } from 'utils/ipfs-parse'
import { request } from 'utils/indexer-request'
import { readStakeArbitrationParams } from 'utils/stake-arbitration-params'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { errorToast, successToast, wrapWithToast } from 'utils/wrap-with-toast'
import { normalizeAddress, shortAddress } from 'pages/dashboard/data'
import { VerifiedBadge } from 'components/curate/verified-badge'
import {
  SUPPORTED_CHAIN_IDS,
  abiForKind,
  chainName,
  type GovernanceParams,
  type GovernedRegistry,
} from './data'
import { formatInt, kindLabel } from './view'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Governed lists: the registries whose governor is the profile address, and
 * the dialog the governor uses to change one parameter at a time. Every
 * write is simulated first, then sent through the wallet with a toast; the
 * contract calls, Atlas upload and court lookup are the same as before.
 */

/* ---------- Parameter plumbing ---------- */

/*
 * Every value is shown in the unit people think in (the chain's coin, the
 * stake token, days, percent) and written in the unit the contract stores
 * (wei, the token's base units, seconds, basis points). Parsing is strict: no
 * grouping, no exponent, no more decimals than the unit has, and an empty
 * field is never read as 0.
 */

type ParamKind = 'wei' | 'token' | 'seconds' | 'multiplier' | 'address'
type ParamKey = keyof GovernanceParams

interface ParamConfig {
  key: ParamKey
  label: string
  kind: ParamKind
  functionName: string
  hint?: string
  /** A period that must stay above zero (0 would skip a protection window). */
  positive?: boolean
}

/** What the dialog reads beyond the registry row. */
interface ParamContext {
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

// The shared helper, so Gnosis reads "xDAI" here like everywhere else.
const nativeSymbol = (chainId: number) => getNativeCurrency(chainId).symbol

const formatParamValue = (
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

type Parsed =
  | { value: bigint | string; error?: undefined }
  | { value?: undefined; error: string }

const parseParamValue = (
  raw: string,
  config: ParamConfig,
  context: ParamContext,
): Parsed => {
  const text = raw.trim()
  if (config.kind === 'address')
    return isAddress(text)
      ? { value: text }
      : { error: 'Enter a valid address' }
  if (text === '') return { error: 'Enter a value' }
  if (!PLAIN_DECIMAL.test(text))
    return { error: 'Use digits and one dot, like 0.5' }
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
  if (config.kind === 'seconds') {
    const seconds = Math.round(Number(text) * DAY_SECONDS)
    if (config.positive && seconds <= 0)
      return { error: 'Must be longer than 0' }
    return { value: BigInt(seconds) }
  }
  if (decimalsIn(text) > 2) return { error: 'At most 2 decimals' }
  return { value: BigInt(Math.round(Number(text) * BPS_PER_PERCENT)) }
}

/** True when the typed value equals what the contract holds now. */
const isUnchanged = (
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

/** The typed value in the stored unit, so nothing is a surprise on chain. */
const describeParsed = (parsed: Parsed, kind: ParamKind) => {
  if (parsed.error !== undefined) return undefined
  if (kind === 'seconds') {
    const seconds = Number(parsed.value)
    return `${formatDurationLong(seconds)} (${seconds.toLocaleString('en-US')} s)`
  }
  if (kind === 'multiplier')
    return `Stored as ${Number(parsed.value).toLocaleString('en-US')} basis points (10,000 = 100%)`
  return undefined
}

const APPEAL_HINT =
  'Appeal stakes are a percent of the appeal cost that each side adds on top when funding an appeal. The winner of the dispute takes the stakes.'

const editableParams = (registry: GovernedRegistry): ParamConfig[] => {
  const permanentTokenLabel =
    registry.params?.tokenSymbol ||
    (registry.token ? shortAddress(registry.token) : 'stake token')

  const appealStakes: ParamConfig[] = [
    {
      key: 'winnerStakeMultiplier',
      label: 'Appeal stake, side that won (%)',
      kind: 'multiplier',
      functionName: 'changeWinnerStakeMultiplier',
      hint: APPEAL_HINT,
    },
    {
      key: 'loserStakeMultiplier',
      label: 'Appeal stake, side that lost (%)',
      kind: 'multiplier',
      functionName: 'changeLoserStakeMultiplier',
    },
    {
      key: 'sharedStakeMultiplier',
      label: 'Appeal stake, no winner (%)',
      kind: 'multiplier',
      functionName: 'changeSharedStakeMultiplier',
    },
  ]
  const governor: ParamConfig = {
    key: 'governor',
    label: 'Governor address',
    kind: 'address',
    functionName: 'changeGovernor',
    hint: 'Hands every setting of this list to another address. After it is mined, this wallet can no longer change anything.',
  }

  if (registry.kind === 'permanent')
    return [
      {
        key: 'submissionMinDeposit',
        label: `Minimum stake (${permanentTokenLabel})`,
        kind: 'token',
        functionName: 'changeSubmissionMinDeposit',
        hint: "The least a submitter must lock to list an entry, in the list's stake token.",
      },
      {
        key: 'submissionPeriod',
        label: 'Submission period (days)',
        kind: 'seconds',
        positive: true,
        functionName: 'changeSubmissionPeriod',
      },
      {
        key: 'reinclusionPeriod',
        label: 'Reinclusion period (days)',
        kind: 'seconds',
        functionName: 'changeReinclusionPeriod',
      },
      {
        key: 'withdrawingPeriod',
        label: 'Withdrawal period (days)',
        kind: 'seconds',
        positive: true,
        functionName: 'changeWithdrawingPeriod',
        hint: 'How long a withdrawing entry stays open to challenge before its stake can be taken back.',
      },
      {
        key: 'challengeStakeMultiplier',
        label: "Challenger stake (% of the entry's stake)",
        kind: 'multiplier',
        functionName: 'changeChallengeStakeMultiplier',
      },
      ...appealStakes,
      governor,
    ]

  const symbol = nativeSymbol(registry.chainId)
  return [
    {
      key: 'submissionBaseDeposit',
      label: `Submission deposit (${symbol})`,
      kind: 'wei',
      functionName: 'changeSubmissionBaseDeposit',
    },
    {
      key: 'submissionChallengeBaseDeposit',
      label: `Challenge deposit, submissions (${symbol})`,
      kind: 'wei',
      functionName: 'changeSubmissionChallengeBaseDeposit',
    },
    {
      key: 'removalBaseDeposit',
      label: `Removal deposit (${symbol})`,
      kind: 'wei',
      functionName: 'changeRemovalBaseDeposit',
    },
    {
      key: 'removalChallengeBaseDeposit',
      label: `Challenge deposit, removals (${symbol})`,
      kind: 'wei',
      functionName: 'changeRemovalChallengeBaseDeposit',
    },
    {
      key: 'challengePeriodDuration',
      label: 'Challenge period (days)',
      kind: 'seconds',
      positive: true,
      functionName:
        registry.kind === 'light'
          ? 'changeChallengePeriodDuration'
          : 'changeTimeToChallenge',
    },
    ...appealStakes,
    {
      key: 'connectedTCR',
      label: 'Badges list (connected TCR) address',
      kind: 'address',
      functionName: 'changeConnectedTCR',
      hint: "The list that holds badges for this list's entries. Use the zero address to disconnect it.",
    },
    ...(registry.kind === 'light'
      ? [
          {
            key: 'relayerContract' as ParamKey,
            label: 'Relayer contract address',
            kind: 'address' as ParamKind,
            functionName: 'changeRelayerContract',
            hint: 'A relayer can add and remove entries directly, with no deposit and no challenge period. Keep the zero address unless you run one.',
          },
        ]
      : []),
    governor,
  ]
}

const buildArbitratorExtraData = (courtID: number, jurors: number) =>
  `0x${courtID.toString(16).padStart(64, '0')}${jurors
    .toString(16)
    .padStart(64, '0')}`

/** Juror count as typed: a whole, odd number from 1 to 33. */
const parseJurors = (text: string): { value?: number; error?: string } => {
  if (!/^\d+$/.test(text.trim())) return { error: 'Enter a whole number' }
  const value = Number(text)
  if (value < 1 || value > 33) return { error: 'Between 1 and 33 jurors' }
  if (value % 2 === 0)
    return { error: 'Use an odd number, so votes cannot tie' }
  return { value }
}

/* ---------- MetaEvidence checks ---------- */

/*
 * A registry's MetaEvidence decides what jurors are asked and how entries
 * decode, so new files are read before anything is signed: each must be a
 * MetaEvidence JSON, keep the live columns (old entries must still decode),
 * and the registration and clearing files must be two different files in
 * the right places.
 */

interface MetaEvidenceFile {
  title?: unknown
  fileURI?: unknown
  metadata?: { columns?: { label?: string; type?: string }[] }
  rulingOptions?: { titles?: string[] }
}

/**
 * A list's arbitration settings as the dialogs start from them. The
 * arbitrator, extra data and change count are read from the chain when the
 * dialog opens. The MetaEvidence URIs exist only in event logs, so they come
 * from the indexer, checked against that count: the save that changes the
 * court also sends the MetaEvidence (Light and Stake), and a file the indexer
 * has not caught up with would quietly undo the last policy change.
 */
export interface CurrentMetaEvidence {
  registration?: string
  clearing?: string
  /**
   * The connected (badges) list. Neither contract has a getter for it, only
   * the ConnectedTCRSet event, so it comes from the indexer.
   */
  connectedTCR?: string
  /** The arbitrator new requests use (Light and Classic). */
  arbitrator?: string
  /** Its extra data: the court and the number of jurors. */
  arbitratorExtraData?: string
  /**
   * How many times the MetaEvidence has changed, read with the values above
   * (metaEvidenceUpdates, or a Stake list's settings entries). The URIs
   * above are the live ones only at this count.
   */
  changes?: number
  /**
   * The indexer has not caught up with the chain's last MetaEvidence change,
   * so the URIs above would be the previous files.
   */
  behind?: boolean
  /** The indexer did not answer: the URIs above are unknown. */
  unreadable?: boolean
}

/**
 * What this page's saves wrote to a list. The indexers and the cached
 * registry index trail the chain, so the console shows these as the current
 * values until the page reloads. A MetaEvidence save also records the change
 * count it produced: its files stand in for the indexer's only while the
 * chain still holds that count, never over a later change made elsewhere.
 */
export interface Written {
  params?: GovernanceParams
  metaEvidence?: CurrentMetaEvidence
}

const mergeWritten = (
  previous: Written | undefined,
  next: Written,
): Written => ({
  params: { ...previous?.params, ...next.params },
  metaEvidence: { ...previous?.metaEvidence, ...next.metaEvidence },
})

const withWritten = (
  registry: GovernedRegistry,
  written: Written | undefined,
): GovernedRegistry =>
  written?.params
    ? {
        ...registry,
        governor: written.params.governor ?? registry.governor,
        params: { ...registry.params, ...written.params },
      }
    : registry

const metaEvidenceUrl = (uri: string) =>
  /^https?:\/\//i.test(uri) ? uri : parseIpfs(uri)

const readMetaEvidence = async (uri: string): Promise<MetaEvidenceFile> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(metaEvidenceUrl(uri), {
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as MetaEvidenceFile
  } finally {
    clearTimeout(timer)
  }
}

const columnsKey = (file: MetaEvidenceFile) =>
  JSON.stringify(
    (file.metadata?.columns ?? []).map((column) => [column.label, column.type]),
  )

/**
 * Whether the file asks jurors to add (or remove) an entry: its title opens
 * with the verb, as the factory writes them ("Add a token to …", "Remove a
 * token from …"), or its first ruling option does ("Yes, Add It"). Names later
 * in the title never count, so a list called "Removals" can still update its
 * registration file, and neutral wording ("Yes" / "No") never flags a file.
 */
const asks = (file: MetaEvidenceFile, verb: 'add' | 'remove') => {
  const word = verb === 'add' ? 'add\\b' : 'remov'
  return (
    new RegExp(`^\\W*${word}`, 'i').test(String(file.title ?? '')) ||
    new RegExp(`^\\W*yes\\W+${word}`, 'i').test(
      String(file.rulingOptions?.titles?.[0] ?? ''),
    )
  )
}

/**
 * What is wrong with a proposed MetaEvidence change, or undefined when it is
 * fine. Files equal to the live ones are not re-read.
 */
const checkMetaEvidence = async ({
  registration,
  clearing,
  current,
}: {
  registration: string
  /** Undefined on Stake Curate, which has a single MetaEvidence. */
  clearing?: string
  current: CurrentMetaEvidence
}): Promise<string | undefined> => {
  if (!registration.trim()) return 'Enter the MetaEvidence URI'
  if (clearing !== undefined) {
    if (!clearing.trim()) return 'Enter the clearing MetaEvidence URI'
    if (registration.trim() === clearing.trim())
      return 'The registration and clearing MetaEvidence must be two different files: jurors are asked to add in one and to remove in the other.'
  }
  const changed = [
    { uri: registration.trim(), role: 'registration' as const },
    ...(clearing !== undefined
      ? [{ uri: clearing.trim(), role: 'clearing' as const }]
      : []),
  ].filter(({ uri, role }) => uri !== current[role])
  if (changed.length === 0) return undefined

  let baseline: MetaEvidenceFile | undefined
  if (current.registration)
    try {
      baseline = await readMetaEvidence(current.registration)
    } catch {
      // Without the live file the columns can't be compared: wait rather than
      // let a column change through while the gateway is slow.
      return 'The current registration file could not be read, so its columns cannot be compared. Try again in a minute.'
    }

  for (const { uri, role } of changed) {
    let file: MetaEvidenceFile
    try {
      file = await readMetaEvidence(uri)
    } catch {
      return `The ${role} MetaEvidence could not be read from ${uri}. Check the URI, or wait for the upload to reach the gateway.`
    }
    if (typeof file.fileURI !== 'string' || !file.metadata?.columns)
      return `The ${role} file is not a Curate MetaEvidence JSON (it needs fileURI and metadata.columns).`
    if (baseline && columnsKey(file) !== columnsKey(baseline))
      return `The ${role} file changes the list's columns. Entries already on the list would no longer display, so keep the same columns.`
    // The registration file asks about adding, the clearing file about
    // removing; a file that says the opposite was put in the wrong field.
    if (role === 'registration' && asks(file, 'remove') && !asks(file, 'add'))
      return 'The registration file asks jurors about removing entries. It looks like the clearing file: swap the two.'
    if (role === 'clearing' && asks(file, 'add') && !asks(file, 'remove'))
      return 'The clearing file asks jurors about adding entries, not removing them. It looks like the registration file: swap the two.'
  }
  return undefined
}

interface ChainArbitration {
  arbitrator?: string
  arbitratorExtraData: string
  changes: number
}

/**
 * What the chain holds now: the arbitrator and extra data new requests use,
 * and how many times the MetaEvidence has changed. Light's getters return
 * the latest settings; a Stake list's latest entry is found by reading its
 * entries in turn.
 */
const readChainArbitration = async (
  registry: GovernedRegistry,
): Promise<ChainArbitration> => {
  if (registry.kind === 'permanent') {
    const { count, arbitratorExtraData } = await readStakeArbitrationParams(
      registry.chainId,
      registry.address,
    )
    return { arbitratorExtraData, changes: count }
  }
  const contract = {
    chainId: registry.chainId,
    address: registry.address as `0x${string}`,
    abi: abiForKind(registry.kind),
  }
  const [arbitrator, arbitratorExtraData, updates] = (await readContracts(
    wagmiConfig,
    {
      allowFailure: false,
      contracts: [
        { ...contract, functionName: 'arbitrator' },
        { ...contract, functionName: 'arbitratorExtraData' },
        { ...contract, functionName: 'metaEvidenceUpdates' },
      ],
    },
  )) as unknown as [string, string, bigint]
  return {
    arbitrator: String(arbitrator),
    arbitratorExtraData: String(arbitratorExtraData),
    changes: Number(updates),
  }
}

/** Whether the chain changed under a dialog since it read `current`. */
const changedSince = (current: CurrentMetaEvidence, chain: ChainArbitration) =>
  current.changes !== chain.changes ||
  (current.arbitratorExtraData ?? '').toLowerCase() !==
    chain.arbitratorExtraData.toLowerCase() ||
  (chain.arbitrator !== undefined &&
    (current.arbitrator ?? '').toLowerCase() !== chain.arbitrator.toLowerCase())

const INDEXER_TIMEOUT_MS = 15_000

/** A read from an indexer, given up after INDEXER_TIMEOUT_MS. */
const readIndexer = async <T,>(
  url: string,
  document: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), INDEXER_TIMEOUT_MS)
  try {
    return await request<T>({
      url,
      document,
      variables,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

const LIGHT_META_EVIDENCE = `
  query GovernanceLightMetaEvidence($id: String!) {
    registry: LRegistry_by_pk(id: $id) {
      registrationMetaEvidence { uri }
      clearingMetaEvidence { uri }
      connectedTCR
      metaEvidenceCount
    }
  }
`

const CLASSIC_META_EVIDENCE = `
  query GovernanceClassicMetaEvidence($id: String!) {
    registry: Registry_by_pk(id: $id) {
      registrationMetaEvidence { uri }
      clearingMetaEvidence { uri }
      connectedTCR
      metaEvidenceCount
    }
  }
`

const STAKE_SETTING = `
  query GovernanceStakeSetting($id: ID!) {
    setting: arbitrationSetting(id: $id) {
      metaEvidenceURI
      arbitratorExtraData
    }
  }
`

/**
 * The live arbitration settings of a list. The chain values come first; it
 * throws when they can't be read, so the dialogs refuse to save instead of
 * starting from values that may be stale. The indexer's MetaEvidence counts
 * only if it is at the chain's change count: Light emits two MetaEvidence
 * logs per settings entry (metaEvidenceUpdates is the number of entries),
 * Classic two at deployment and two per update, and the Stake subgraph keys
 * each settings entry by its index. Otherwise the result is `behind`, or
 * `unreadable` when the indexer did not answer: only the saves that send
 * MetaEvidence need it (a Classic arbitrator change does not).
 */
const fetchCurrentMetaEvidence = async (
  registry: GovernedRegistry,
): Promise<CurrentMetaEvidence> => {
  const chain = await readChainArbitration(registry)
  const id = registry.address.toLowerCase()

  if (registry.kind === 'permanent') {
    const url = subgraphUrlPermanent[registry.chainId]
    const answer = url
      ? await readIndexer<{
          setting?: { metaEvidenceURI?: string; arbitratorExtraData?: string }
        }>(url, STAKE_SETTING, { id: `${id}-${chain.changes - 1}` }).catch(
          () => undefined,
        )
      : undefined
    if (!answer) return { ...chain, unreadable: true }
    const { setting } = answer
    const indexed =
      !!setting?.metaEvidenceURI &&
      (setting.arbitratorExtraData ?? '').toLowerCase() ===
        chain.arbitratorExtraData.toLowerCase()
    return {
      ...chain,
      registration: indexed ? setting?.metaEvidenceURI : undefined,
      behind: !indexed,
    }
  }

  const url = subgraphUrl[registry.chainId]
  const answer = url
    ? await readIndexer<{
        registry?: {
          registrationMetaEvidence?: { uri?: string }
          clearingMetaEvidence?: { uri?: string }
          connectedTCR?: string
          metaEvidenceCount?: string | number
        }
      }>(
        url,
        registry.kind === 'light' ? LIGHT_META_EVIDENCE : CLASSIC_META_EVIDENCE,
        { id },
      ).catch(() => undefined)
    : undefined
  const indexed = answer?.registry
  if (!indexed) return { ...chain, unreadable: true }
  const expected =
    registry.kind === 'light' ? 2 * chain.changes : 2 * (chain.changes + 1)
  const current = Number(indexed.metaEvidenceCount) === expected
  return {
    ...chain,
    registration: current
      ? indexed.registrationMetaEvidence?.uri || undefined
      : undefined,
    clearing: current
      ? indexed.clearingMetaEvidence?.uri || undefined
      : undefined,
    connectedTCR: indexed.connectedTCR || undefined,
    behind: !current,
  }
}

const CURRENT_UNREADABLE =
  "The list's current settings could not be read. Close and reopen this dialog to try again."
const META_EVIDENCE_UNREADABLE =
  "The list's current MetaEvidence could not be read from the indexer. Close and reopen this dialog to try again."
const INDEXER_BEHIND =
  "The indexer has not caught up with this list's latest MetaEvidence yet, so this dialog can't start from the live files. Try again in a minute."
const SETTINGS_CHANGED =
  "This list's settings changed since this dialog opened, so nothing was sent. The fields you did not edit now show the new values: check them and save again."

/* ---------- Dialog shell ---------- */

const backdropIn = keyframes`
  from { opacity: 0; }
`

const dialogIn = keyframes`
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
`

const sheetIn = keyframes`
  from { transform: translateY(100%); }
`

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  overflow-y: auto;

  @media (max-width: 720px) {
    align-items: flex-end;
    padding: 0;
  }
`

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--stage) 62%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: ${backdropIn} 240ms ease both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Dialog = styled.div`
  position: relative;
  width: 100%;
  max-width: 760px;
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  outline: none;
  animation: ${dialogIn} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;

  @media (max-width: 720px) {
    max-width: none;
    max-height: 92vh;
    overflow-y: auto;
    border-radius: 24px 24px 0 0;
    animation: ${sheetIn} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const DialogHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--glass-border);

  h3 {
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
`

const DialogBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 24px;

  @media (max-width: 720px) {
    padding: 16px;
  }
`

/** What Tab can land on inside the dialog; the dialog itself (tabindex -1) is excluded. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

const DialogShell = ({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // The latest close handler, so the mount effect never re-runs (and never
  // steals focus from a field) when the panel re-renders behind the dialog.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Keep Tab inside the dialog: wrap from the last field to the first
      // and back, and pull focus in if it ever lands on the page behind.
      const dialog = dialogRef.current
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && dialog.contains(active)
      if (event.shiftKey) {
        if (!inside || active === first || active === dialog) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <Layer>
      <Backdrop onClick={onClose} aria-hidden />
      <Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <DialogHead>
          <Subheading id={titleId}>{title}</Subheading>
          <IconButton type="button" aria-label="Close" onClick={onClose}>
            <CurateIcon name="close" size={16} />
          </IconButton>
        </DialogHead>
        <DialogBody>{children}</DialogBody>
      </Dialog>
    </Layer>,
    document.body,
  )
}

/* ---------- Form chrome ---------- */

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid var(--glass-border);
`

const FieldLabel = styled.label`
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
`

const Controls = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const TwoUp = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

/* The app's glass Select, at the field's full width. */
const CourtSelect = styled(Select)`
  display: block;
  width: 100%;
  min-width: 0;

  .ui-select-trigger {
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
`

const HiddenFileInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const GateRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
`

/** What stops a save right now, if anything. */
interface SaveGate {
  blocker?: string
  helper?: { label: string; onClick: () => void; loading?: boolean }
}

/* ---------- Writes ---------- */

const FieldNote = styled(Small)<{ $error?: boolean }>`
  display: block;
  color: ${({ $error }) =>
    $error ? 'var(--color-danger)' : 'var(--color-faint)'};
`

/**
 * Simulates the call from the connected wallet, sends it with a toast, and
 * turns a revert or a refused signature into a message instead of failing
 * silently. Resolves true once the transaction is mined and succeeded.
 */
const useGovernanceWrite = (registry: GovernedRegistry) => {
  const { data: walletClient } = useWalletClient()
  const [pending, setPending] = useState(false)
  const send = async (functionName: string, args: unknown[]) => {
    if (!walletClient) return false
    setPending(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        chainId: registry.chainId,
        address: registry.address as `0x${string}`,
        abi: abiForKind(registry.kind),
        functionName,
        args,
      } as any)
      const publicClient = getPublicClient(wagmiConfig, {
        chainId: registry.chainId,
      })
      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient!,
      )
      return result.status
    } catch (err) {
      console.error(err)
      errorToast(parseWagmiError(err))
      return false
    } finally {
      setPending(false)
    }
  }
  return { walletClient, pending, send }
}

/**
 * False once the field unmounts: a save whose dialog was closed while its
 * checks ran must not go on to open the wallet.
 */
const useAlive = () => {
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  return alive
}

/* ---------- MetaEvidence input ---------- */

const UriRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const MetaEvidenceInput = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) => {
  const { uploadFile } = useAtlasProvider()
  const [uploading, setUploading] = useState(false)
  const id = useId()

  const upload = async (file?: File) => {
    if (!file) return
    if (
      file.type !== 'application/json' &&
      !file.name.toLowerCase().endsWith('.json')
    ) {
      errorToast('Upload a MetaEvidence JSON file.')
      return
    }
    setUploading(true)
    try {
      const uri = await uploadFile(file, JSON_UPLOAD_ROLE)
      if (!uri) throw new Error('Atlas upload failed.')
      onChange(uri)
    } catch (err) {
      console.error(err)
      errorToast('MetaEvidence upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Stack $gap={4}>
      <Label as="label" htmlFor={id}>
        {label}
      </Label>
      <UriRow>
        <TextInput
          id={id}
          value={value}
          disabled={disabled || uploading}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="/ipfs/… or https://…"
        />
        <EnsureAuth>
          <ButtonAnchor
            as="label"
            $variant="secondary"
            $size="sm"
            aria-disabled={disabled || uploading}
          >
            <CurateIcon name="submit" size={14} />
            {uploading ? 'Uploading…' : 'Upload JSON'}
            <HiddenFileInput
              type="file"
              accept="application/json,.json"
              disabled={disabled || uploading}
              onChange={(event) => upload(event.currentTarget.files?.[0])}
            />
          </ButtonAnchor>
        </EnsureAuth>
      </UriRow>
    </Stack>
  )
}

/**
 * The registration and clearing URIs as fields that start on the live files
 * and follow them until the governor edits one.
 */
const useMetaEvidenceDraft = (current: CurrentMetaEvidence | undefined) => {
  const [registration, setRegistration] = useState('')
  const [clearing, setClearing] = useState('')
  const [edited, setEdited] = useState(false)
  useEffect(() => {
    if (edited || !current) return
    setRegistration(current.registration ?? '')
    setClearing(current.clearing ?? '')
  }, [current, edited])
  return {
    registration,
    clearing,
    setRegistration: (value: string) => {
      setEdited(true)
      setRegistration(value)
    },
    setClearing: (value: string) => {
      setEdited(true)
      setClearing(value)
    },
    reset: () => setEdited(false),
  }
}

/* ---------- Arbitration and court ---------- */

const ArbitrationGovernanceField = ({
  registry,
  current,
  currentError,
  gate,
  onSaved,
  onOutdated,
}: {
  registry: GovernedRegistry
  /** The live settings; undefined while they load or if they can't be read. */
  current: CurrentMetaEvidence | undefined
  /** The live settings could not be read. */
  currentError?: boolean
  gate: SaveGate
  onSaved: (written: Written) => void
  /** The chain changed since `current` was read: read it again. */
  onOutdated: () => void
}) => {
  const { walletClient, pending, send } = useGovernanceWrite(registry)
  const alive = useAlive()
  const chainProvider = useEthersProvider({ chainId: registry.chainId })
  const knownKleros = klerosAddresses[registry.chainId]
  // The chain's values once read; until then the scan's, shown but never saved.
  const currentArbitrator =
    current?.arbitrator || registry.params?.arbitrator || ''
  const [arbitrator, setArbitrator] = useState(
    currentArbitrator || knownKleros?.arbitrator || '',
  )
  const courtArbitrator =
    registry.kind === 'permanent' ? knownKleros?.arbitrator : arbitrator
  const { data: courts = [] } = useCourtPolicies(
    knownKleros?.policy,
    chainProvider ?? null,
    courtArbitrator,
  )
  const currentExtraData =
    current?.arbitratorExtraData || registry.params?.arbitratorExtraData || ''
  const decodedCurrent = useMemo(() => {
    if (!currentExtraData || currentExtraData === '0x') return undefined
    try {
      return jurorsAndCourtIDFromExtraData(currentExtraData)
    } catch {
      return undefined
    }
  }, [currentExtraData])
  const [courtID, setCourtID] = useState(
    decodedCurrent ? String(decodedCurrent.courtID) : '',
  )
  const [jurors, setJurors] = useState(
    decodedCurrent ? String(decodedCurrent.numberOfJurors) : '3',
  )
  // The fields follow the live values (they arrive after the dialog opens)
  // until the governor edits one.
  const [settingsEdited, setSettingsEdited] = useState(false)
  useEffect(() => {
    if (settingsEdited) return
    if (currentArbitrator) setArbitrator(currentArbitrator)
    if (decodedCurrent) {
      setCourtID(String(decodedCurrent.courtID))
      setJurors(String(decodedCurrent.numberOfJurors))
    }
  }, [settingsEdited, currentArbitrator, decodedCurrent])
  const meta = useMetaEvidenceDraft(current)
  const [checking, setChecking] = useState(false)
  const ids = useId()

  const usesPair = registry.kind === 'light'
  const usesSingle = registry.kind === 'permanent'
  const jurorCount = parseJurors(jurors)
  const courtNumber = /^\d+$/.test(courtID) ? Number(courtID) : undefined
  const extraData =
    courtNumber !== undefined && jurorCount.value !== undefined
      ? buildArbitratorExtraData(courtNumber, jurorCount.value)
      : undefined
  const changed =
    (registry.kind !== 'permanent' &&
      arbitrator.toLowerCase() !== currentArbitrator.toLowerCase()) ||
    (extraData !== undefined &&
      extraData.toLowerCase() !== currentExtraData.toLowerCase()) ||
    ((usesPair || usesSingle) &&
      meta.registration.trim() !== (current?.registration ?? '')) ||
    (usesPair && meta.clearing.trim() !== (current?.clearing ?? ''))
  // Every save sends values the governor did not touch along with the ones
  // they did (Light and Stake send the court and the MetaEvidence together):
  // without the live values, refuse rather than send stale ones back.
  const inputError = !current
    ? currentError
      ? CURRENT_UNREADABLE
      : 'Reading the current settings…'
    : (usesPair || usesSingle) && current.unreadable
      ? META_EVIDENCE_UNREADABLE
      : (usesPair || usesSingle) && current.behind
        ? INDEXER_BEHIND
        : registry.kind !== 'permanent' && !isAddress(arbitrator)
          ? 'Enter a valid arbitrator address'
          : courtNumber === undefined
            ? 'Choose a court'
            : jurorCount.error
              ? `Jurors: ${jurorCount.error}`
              : undefined
  const blocker =
    gate.blocker ??
    (!walletClient
      ? 'Wallet not ready'
      : (inputError ?? (changed ? undefined : 'No change')))
  const locked = Boolean(gate.blocker) || pending || checking

  const save = async () => {
    if (blocker || !extraData || !current) return
    const arbitratorChanged =
      registry.kind !== 'permanent' &&
      arbitrator.toLowerCase() !== currentArbitrator.toLowerCase()
    setChecking(true)
    let outdated = false
    const problem = await (async () => {
      // The values this dialog started from must still be the chain's: a
      // change made since (another tab, another signer of the governor)
      // would otherwise be undone by the ones it sends back unchanged.
      if (changedSince(current, await readChainArbitration(registry))) {
        outdated = true
        return SETTINGS_CHANGED
      }
      // A mistyped arbitrator would mine, and the list could take no
      // request (every arbitration cost read reverts) until it is fixed.
      if (arbitratorChanged) {
        const code = await getPublicClient(wagmiConfig, {
          chainId: registry.chainId,
        })?.getCode({ address: arbitrator as `0x${string}` })
        if (!code || code === '0x')
          return `There is no contract at ${arbitrator} on ${chainName(registry.chainId)}, so it cannot arbitrate.`
      }
      if (!usesPair && !usesSingle) return undefined
      return checkMetaEvidence({
        registration: meta.registration,
        clearing: usesPair ? meta.clearing : undefined,
        current,
      })
    })().catch(() => 'The checks before saving failed. Try again.')
    if (!alive.current) return
    setChecking(false)
    if (outdated) onOutdated()
    if (problem) {
      errorToast(problem)
      return
    }
    const registration = meta.registration.trim()
    const clearing = meta.clearing.trim()
    const functionName =
      registry.kind === 'classic'
        ? 'changeArbitrator'
        : 'changeArbitrationParams'
    const args =
      registry.kind === 'classic'
        ? [arbitrator, extraData]
        : registry.kind === 'light'
          ? [arbitrator, extraData, registration, clearing]
          : [extraData, registration]
    if (await send(functionName, args)) {
      meta.reset()
      setSettingsEdited(false)
      // Light and Stake add a settings entry: one more MetaEvidence change.
      const changes = (current.changes ?? 0) + 1
      onSaved({
        params: {
          ...(registry.kind !== 'permanent' ? { arbitrator } : {}),
          arbitratorExtraData: extraData,
          ...(usesSingle ? { metaEvidenceURI: registration } : {}),
        },
        ...(usesPair
          ? { metaEvidence: { registration, clearing, changes } }
          : usesSingle
            ? { metaEvidence: { registration, changes } }
            : {}),
      })
    }
  }

  const selectedCourt = courts.find(
    (court) => String(court.courtID) === courtID,
  )
  const symbol = nativeSymbol(registry.chainId)
  const feePerJuror = selectedCourt?.feeForJuror
    ? Number(formatEther(BigInt(selectedCourt.feeForJuror))).toLocaleString(
        undefined,
        { maximumFractionDigits: 6 },
      )
    : null

  return (
    <Field>
      <div>
        <FieldLabel as="div">
          {registry.kind === 'permanent'
            ? 'Court and MetaEvidence'
            : 'Arbitrator and court'}
        </FieldLabel>
        <Small $muted>
          {registry.kind === 'classic'
            ? 'Choosing a court rewrites the arbitrator extra data.'
            : registry.kind === 'light'
              ? 'Light Curate changes the court together with both MetaEvidence files. They start on the live files: keep them to change only the court, or upload new ones (same columns) to change the policy too.'
              : 'Stake Curate changes the court together with its MetaEvidence. It starts on the live file: keep it to change only the court.'}
        </Small>
      </div>
      <Controls>
        <Stack $gap={8}>
          {registry.kind !== 'permanent' && (
            <TextInput
              value={arbitrator}
              disabled={locked}
              onChange={(event) => {
                setSettingsEdited(true)
                setArbitrator(event.currentTarget.value)
              }}
              placeholder="Arbitrator address"
              aria-label="Arbitrator address"
            />
          )}
          <TwoUp>
            <Stack $gap={4}>
              <Label
                as="label"
                id={`${ids}-court-label`}
                htmlFor={`${ids}-court`}
              >
                Court
              </Label>
              <CourtSelect
                id={`${ids}-court`}
                aria-labelledby={`${ids}-court-label`}
                value={courtID}
                disabled={locked || courts.length === 0}
                placeholder={
                  courts.length > 0 ? 'Select court' : 'Court list unavailable'
                }
                onChange={(value) => {
                  setSettingsEdited(true)
                  setCourtID(
                    String(typeof value === 'object' ? value.key : value),
                  )
                }}
              >
                {courts.map((court) => (
                  <Select.Option key={court.value} value={String(court.value)}>
                    {court.label} · ID {court.courtID}
                  </Select.Option>
                ))}
              </CourtSelect>
            </Stack>
            <Stack $gap={4}>
              <Label as="label" htmlFor={`${ids}-jurors`}>
                Number of jurors
              </Label>
              <TextInput
                id={`${ids}-jurors`}
                value={jurors}
                disabled={locked}
                onChange={(event) => {
                  setSettingsEdited(true)
                  setJurors(event.currentTarget.value)
                }}
                placeholder="Number of jurors"
                inputMode="numeric"
                aria-invalid={Boolean(jurorCount.error)}
              />
            </Stack>
          </TwoUp>
          {selectedCourt && (
            <Small $muted>
              {selectedCourt.summary ||
                `${selectedCourt.label} handles disputes sent to this court.`}{' '}
              Fee per juror:{' '}
              <Data $weight={500}>
                {feePerJuror ? `${feePerJuror} ${symbol}` : 'unavailable'}
              </Data>
            </Small>
          )}
          <TextInput
            value={extraData ?? currentExtraData}
            disabled
            readOnly
            aria-label="Arbitrator extra data"
            placeholder="Arbitrator extra data is generated from the court"
          />
          {usesPair && (
            <TwoUp>
              <MetaEvidenceInput
                label="Registration MetaEvidence"
                value={meta.registration}
                disabled={locked}
                onChange={meta.setRegistration}
              />
              <MetaEvidenceInput
                label="Clearing MetaEvidence"
                value={meta.clearing}
                disabled={locked}
                onChange={meta.setClearing}
              />
            </TwoUp>
          )}
          {usesSingle && (
            <MetaEvidenceInput
              label="MetaEvidence"
              value={meta.registration}
              disabled={locked}
              onChange={meta.setRegistration}
            />
          )}
          {inputError && !gate.blocker && (
            <FieldNote $error role="alert">
              {inputError}
            </FieldNote>
          )}
        </Stack>
        <Button
          type="button"
          $variant="primary"
          disabled={Boolean(blocker) || locked}
          title={blocker}
          onClick={save}
        >
          {checking ? 'Checking…' : pending ? 'Saving…' : 'Save'}
        </Button>
      </Controls>
    </Field>
  )
}

/* ---------- MetaEvidence of a Classic list ---------- */

const MetaEvidencePairField = ({
  registry,
  current,
  currentError,
  gate,
  onSaved,
  onOutdated,
}: {
  registry: GovernedRegistry
  current: CurrentMetaEvidence | undefined
  currentError?: boolean
  gate: SaveGate
  onSaved: (written: Written) => void
  /** The chain changed since `current` was read: read it again. */
  onOutdated: () => void
}) => {
  const { walletClient, pending, send } = useGovernanceWrite(registry)
  const alive = useAlive()
  const meta = useMetaEvidenceDraft(current)
  const [checking, setChecking] = useState(false)
  const changed =
    meta.registration.trim() !== (current?.registration ?? '') ||
    meta.clearing.trim() !== (current?.clearing ?? '')
  // Both files are sent together: one left as it was must be the live one.
  const blocker =
    gate.blocker ??
    (!walletClient
      ? 'Wallet not ready'
      : !current
        ? currentError
          ? CURRENT_UNREADABLE
          : 'Reading the current MetaEvidence…'
        : current.unreadable
          ? META_EVIDENCE_UNREADABLE
          : current.behind
            ? INDEXER_BEHIND
            : changed
              ? undefined
              : 'No change')
  const locked = Boolean(gate.blocker) || pending || checking

  const save = async () => {
    if (blocker || !current) return
    setChecking(true)
    let outdated = false
    const problem = await (async () => {
      if (changedSince(current, await readChainArbitration(registry))) {
        outdated = true
        return SETTINGS_CHANGED
      }
      return checkMetaEvidence({
        registration: meta.registration,
        clearing: meta.clearing,
        current,
      })
    })().catch(() => 'The MetaEvidence check failed. Try again.')
    if (!alive.current) return
    setChecking(false)
    if (outdated) onOutdated()
    if (problem) {
      errorToast(problem)
      return
    }
    const registration = meta.registration.trim()
    const clearing = meta.clearing.trim()
    if (await send('changeMetaEvidence', [registration, clearing])) {
      meta.reset()
      // changeMetaEvidence adds one to metaEvidenceUpdates.
      onSaved({
        metaEvidence: {
          registration,
          clearing,
          changes: (current.changes ?? 0) + 1,
        },
      })
    }
  }

  return (
    <Field>
      <div>
        <FieldLabel as="div">MetaEvidence</FieldLabel>
        <Small $muted>
          Two files: jurors read the registration file on submissions and the
          clearing file on removals. To change the policy, upload both with the
          new policy and the same columns.
        </Small>
      </div>
      <Controls>
        <Stack $gap={8}>
          <MetaEvidenceInput
            label="Registration MetaEvidence"
            value={meta.registration}
            disabled={locked}
            onChange={meta.setRegistration}
          />
          <MetaEvidenceInput
            label="Clearing MetaEvidence"
            value={meta.clearing}
            disabled={locked}
            onChange={meta.setClearing}
          />
        </Stack>
        <Button
          type="button"
          $variant="primary"
          disabled={Boolean(blocker) || locked}
          title={blocker}
          onClick={save}
        >
          {checking ? 'Checking…' : pending ? 'Saving…' : 'Save'}
        </Button>
      </Controls>
    </Field>
  )
}

/* ---------- One parameter ---------- */

const GovernanceField = ({
  registry,
  config,
  context,
  gate,
  onSaved,
}: {
  registry: GovernedRegistry
  config: ParamConfig
  context: ParamContext
  gate: SaveGate
  onSaved: (written: Written) => void
}) => {
  const { walletClient, pending, send } = useGovernanceWrite(registry)
  const inputId = useId()
  const noteId = useId()
  const current = registry.params?.[config.key]
  const initial = formatParamValue(current, config.kind, context)
  const [value, setValue] = useState(initial)
  const [edited, setEdited] = useState(false)
  // A governor transfer takes a second, deliberate click.
  const [armed, setArmed] = useState(false)
  // Whether the new governor has code on this chain; undefined until read.
  const [governorHasCode, setGovernorHasCode] = useState<boolean>()
  // Follow the live value (and late reads such as token decimals) until edited.
  useEffect(() => {
    if (!edited) setValue(initial)
  }, [initial, edited])

  const parsed = parseParamValue(value, config, context)
  const isGovernor = config.key === 'governor'
  const target = isGovernor ? String(parsed.value ?? '').toLowerCase() : ''
  // Contracts that can never send a governance call would freeze the list.
  const inert = [registry.params?.arbitrator, registry.token]
    .filter((address): address is string => Boolean(address))
    .some((address) => address.toLowerCase() === target)
  const inputError =
    parsed.error ??
    (!isGovernor
      ? undefined
      : target === zeroAddress
        ? 'The zero address would leave the list without a governor'
        : target === registry.address.toLowerCase()
          ? 'The list cannot govern itself: nobody could change it again'
          : inert
            ? "That is the list's arbitrator or token contract, which cannot send governance transactions"
            : undefined)
  const unchanged = isUnchanged(parsed, current, config.kind)
  const blocker =
    gate.blocker ??
    (!walletClient
      ? 'Wallet not ready'
      : (inputError ?? (unchanged ? 'No change' : undefined)))
  const locked = Boolean(gate.blocker) || pending
  const description = describeParsed(parsed, config.kind)

  const save = async () => {
    if (blocker || parsed.error !== undefined) return
    if (isGovernor && !armed) {
      setArmed(true)
      setGovernorHasCode(undefined)
      getPublicClient(wagmiConfig, { chainId: registry.chainId })
        ?.getCode({ address: target as `0x${string}` })
        .then((code) => setGovernorHasCode(Boolean(code && code !== '0x')))
        .catch(() => setGovernorHasCode(undefined))
      return
    }
    if (await send(config.functionName, [parsed.value])) {
      setEdited(false)
      setArmed(false)
      onSaved({
        params: { [config.key]: String(parsed.value) } as GovernanceParams,
      })
    }
  }

  const placeholder =
    config.kind === 'seconds'
      ? 'days'
      : config.kind === 'multiplier'
        ? '%'
        : config.kind === 'address'
          ? '0x…'
          : undefined

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{config.label}</FieldLabel>
      <Controls>
        <Stack $gap={6}>
          <TextInput
            id={inputId}
            value={value}
            placeholder={placeholder}
            disabled={locked}
            inputMode={config.kind === 'address' ? 'text' : 'decimal'}
            aria-invalid={edited && Boolean(inputError)}
            aria-describedby={noteId}
            onChange={(event) => {
              setValue(event.currentTarget.value)
              setEdited(true)
              setArmed(false)
            }}
          />
          {edited && inputError ? (
            <FieldNote id={noteId} $error role="alert">
              {inputError}
            </FieldNote>
          ) : description ? (
            <FieldNote id={noteId}>{description}</FieldNote>
          ) : null}
          {armed && (
            <GateRow role="alert">
              <Small>
                This hands {registry.title} to{' '}
                <Data $mono style={{ overflowWrap: 'anywhere' }}>
                  {String(parsed.value)}
                </Data>
                . After it is mined, only that address can change the list.
                {governorHasCode === false &&
                  ` There is no contract at that address on ${chainName(registry.chainId)}: fine for a personal wallet, but a Safe must exist on ${chainName(registry.chainId)} itself.`}
              </Small>
            </GateRow>
          )}
        </Stack>
        <Button
          type="button"
          $variant={armed ? 'danger' : 'primary'}
          disabled={Boolean(blocker) || locked}
          title={blocker}
          onClick={save}
        >
          {pending ? 'Saving…' : armed ? 'Confirm transfer' : 'Save'}
        </Button>
      </Controls>
      {config.hint && <Small $muted>{config.hint}</Small>}
    </Field>
  )
}

/* ---------- Update dialog ---------- */

const GovernanceDialog = ({
  registry,
  editable,
  profileAddress,
  written,
  onWritten,
  onClose,
}: {
  /** The list, with this page's saved params already laid over it. */
  registry: GovernedRegistry
  editable: boolean
  profileAddress: string
  /** What this page's saves wrote to the list (see Written). */
  written?: Written
  onWritten: (written: Written) => void
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const { chainId: walletChainId } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const wrongChain = editable && walletChainId !== registry.chainId
  const gate: SaveGate = !editable
    ? { blocker: 'Only the governor wallet can save changes' }
    : wrongChain
      ? {
          blocker: `Switch to ${chainName(registry.chainId)} to save`,
          helper: {
            label: `Switch to ${chainName(registry.chainId)}`,
            onClick: () => switchChain({ chainId: registry.chainId }),
            loading: switching,
          },
        }
      : {}
  const saved = (next: Written) => {
    onWritten(next)
    void queryClient.invalidateQueries({
      queryKey: ['addressProfile', profileAddress],
    })
    void queryClient.invalidateQueries({
      queryKey: ['governanceMetaEvidence', registry.chainId, registry.address],
    })
  }
  // The list's live settings, read again each time the dialog opens.
  const metaEvidence = useQuery({
    queryKey: ['governanceMetaEvidence', registry.chainId, registry.address],
    queryFn: () => fetchCurrentMetaEvidence(registry),
    staleTime: 0,
    retry: 1,
  })
  // This page's last MetaEvidence save stands in for the indexer, which may
  // not have caught up with it, while the chain still holds the change it
  // made; a later change made elsewhere is the indexer's to report.
  const fetchedMetaEvidence = metaEvidence.data
  const writtenMetaEvidence = written?.metaEvidence
  const currentMetaEvidence = useMemo<CurrentMetaEvidence | undefined>(() => {
    if (!fetchedMetaEvidence) return undefined
    if (
      writtenMetaEvidence?.changes === undefined ||
      writtenMetaEvidence.changes !== fetchedMetaEvidence.changes
    )
      return fetchedMetaEvidence
    return {
      ...fetchedMetaEvidence,
      registration: writtenMetaEvidence.registration,
      clearing: writtenMetaEvidence.clearing ?? fetchedMetaEvidence.clearing,
      behind: false,
      unreadable: false,
    }
  }, [fetchedMetaEvidence, writtenMetaEvidence])
  const metaEvidenceError = metaEvidence.isError && !currentMetaEvidence
  const readSettingsAgain = () => void metaEvidence.refetch()
  // Stake amounts are in the token's own decimals, never assumed to be 18.
  const tokenDecimals = useReadContract({
    address: registry.token as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: registry.chainId,
    query: {
      enabled: registry.kind === 'permanent' && Boolean(registry.token),
      staleTime: Infinity,
    },
  })
  // The connected (badges) list has no contract getter: use the indexer's.
  const withIndexedParams = useMemo<GovernedRegistry>(
    () =>
      currentMetaEvidence?.connectedTCR && !registry.params?.connectedTCR
        ? {
            ...registry,
            params: {
              ...registry.params,
              connectedTCR: currentMetaEvidence.connectedTCR,
            },
          }
        : registry,
    [registry, currentMetaEvidence?.connectedTCR],
  )
  const context: ParamContext = {
    tokenDecimals:
      tokenDecimals.data === undefined ? undefined : Number(tokenDecimals.data),
  }

  return (
    <DialogShell title={`Update ${registry.title}`} onClose={onClose}>
      <Small $muted>
        Changes are sent one parameter at a time. Each is simulated before the
        wallet asks you to sign, so a change that would revert is caught before
        you pay gas.
      </Small>
      {gate.blocker && (
        <GateRow>
          <Small $muted role="status">
            {gate.blocker}
          </Small>
          {gate.helper && (
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              disabled={gate.helper.loading}
              onClick={gate.helper.onClick}
            >
              {gate.helper.loading ? 'Waiting…' : gate.helper.label}
            </Button>
          )}
        </GateRow>
      )}
      <div>
        <Label>Arbitration and court</Label>
        <ArbitrationGovernanceField
          registry={registry}
          current={currentMetaEvidence}
          currentError={metaEvidenceError}
          gate={gate}
          onSaved={saved}
          onOutdated={readSettingsAgain}
        />
      </div>
      {registry.kind === 'classic' && (
        <div>
          <Label>Policy</Label>
          <MetaEvidencePairField
            registry={registry}
            current={currentMetaEvidence}
            currentError={metaEvidenceError}
            gate={gate}
            onSaved={saved}
            onOutdated={readSettingsAgain}
          />
        </div>
      )}
      <div>
        <Label>Registry parameters</Label>
        {editableParams(registry).map((config) => (
          <GovernanceField
            key={`${registry.id}-${config.key}`}
            registry={withIndexedParams}
            config={config}
            context={context}
            gate={gate}
            onSaved={saved}
          />
        ))}
      </div>
    </DialogShell>
  )
}

/* ---------- Court of a governed list (plumbing unchanged) ---------- */

const CourtDisplay = ({ registry }: { registry: GovernedRegistry }) => {
  const extraData =
    registry.params?.arbitratorExtraData || registry.arbitratorExtraData
  const knownKleros = klerosAddresses[registry.chainId]
  const chainProvider = useEthersProvider({ chainId: registry.chainId })
  const { data: courts = [] } = useCourtPolicies(
    knownKleros?.policy,
    chainProvider ?? null,
  )

  if (!extraData || extraData === '0x') return <>Unavailable</>

  let decoded: ReturnType<typeof jurorsAndCourtIDFromExtraData>
  try {
    decoded = jurorsAndCourtIDFromExtraData(extraData)
  } catch {
    return <>Court data unavailable</>
  }
  const court = courts.find(
    (item) => String(item.courtID) === String(decoded.courtID),
  )

  return (
    <>
      {court?.label || 'Court'}
      {` · ID ${decoded.courtID}`}
      {decoded.numberOfJurors
        ? ` · ${decoded.numberOfJurors} ${Number(decoded.numberOfJurors) === 1 ? 'juror' : 'jurors'}`
        : ''}
    </>
  )
}

/* ---------- Panel ---------- */

const GovList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const GovRow = styled.li`
  display: grid;
  grid-template-columns: 40px minmax(0, 1.2fr) minmax(0, 1.4fr) auto;
  align-items: center;
  gap: 16px 20px;
  min-height: 76px;
  padding: 16px 16px 16px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition:
    border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);

  &:hover {
    border-color: var(--color-border-strong);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-card-hover);
  }

  @media (max-width: 980px) {
    grid-template-columns: 40px minmax(0, 1fr);

    > :nth-child(n + 3) {
      grid-column: 1 / -1;
    }
  }
`

const GovName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  small {
    color: var(--color-faint);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 16px;
  }
`

/** The list's name, then its Kleros Verified seal; the name gives way first. */
const TitleLine = styled.span`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;

  > a {
    flex: 0 1 auto;
    min-width: 0;
  }
`

const RegistryTitle = styled(Link)`
  display: block;
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--motion);

  &:hover {
    color: var(--color-primary);
  }
`

const Facts = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) auto auto;
  gap: 4px 24px;
  margin: 0;
  min-width: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  dd {
    margin: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr) auto;

    div:first-child {
      grid-column: 1 / -1;
    }
  }
`

const GovActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;

  @media (max-width: 980px) {
    justify-content: flex-start;
  }
`

const GovHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 72px 0 20px;

  h2 {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 30px;
    line-height: 34px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  h2 small {
    color: var(--color-faint);
    font-family: var(--font-figure);
    font-size: 16px;
    line-height: 1;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  p {
    flex-basis: 100%;
    margin: -4px 0 0;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 720px) {
    margin-top: 48px;

    h2 {
      font-size: 26px;
      line-height: 30px;
    }
  }
`

/** The creation date, a placeholder while it is read, or a dash. */
const CreatedValue = ({
  time,
  pending,
}: {
  time?: number
  pending: boolean
}) =>
  time ? (
    <>{formatDate(time)}</>
  ) : pending ? (
    <SkeletonBlock $width="84px" $height="16px" aria-hidden />
  ) : (
    <>—</>
  )

export const GovernancePanel = ({
  registries,
  profileAddress,
  loading,
  isZero = false,
}: {
  registries: GovernedRegistry[]
  profileAddress: string
  loading?: boolean
  /** The zero address: its lists can no longer change parameters. */
  isZero?: boolean
}) => {
  const { address: connectedAddress, isConnected } = useAccount()
  // What this page's saves wrote, by list (see Written). The rows and the
  // dialog show it over the indexed values, which trail the chain.
  const [written, setWritten] = useState<Record<string, Written>>({})
  const shown = useMemo(
    () =>
      registries.map((registry) => withWritten(registry, written[registry.id])),
    [registries, written],
  )
  // The open dialog follows the live list by id, so a background refresh
  // shows newer values than the snapshot taken when the dialog opened.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<GovernedRegistry | null>(null)
  const selectedBase = selectedId
    ? (registries.find((registry) => registry.id === selectedId) ?? snapshot)
    : null
  const selected = selectedBase
    ? withWritten(selectedBase, written[selectedBase.id])
    : null
  const setSelected = (registry: GovernedRegistry | null) => {
    setSelectedId(registry?.id ?? null)
    setSnapshot(registry)
  }
  const recordWritten = (registry: GovernedRegistry, next: Written) => {
    setWritten((previous) => ({
      ...previous,
      [registry.id]: mergeWritten(previous[registry.id], next),
    }))
    // A governor transfer ends this wallet's say over the list.
    if (next.params?.governor) {
      setSelected(null)
      successToast(`${registry.title} has a new governor.`)
    }
  }
  const connected = normalizeAddress(connectedAddress)
  const isOwner = isConnected && connected === profileAddress
  const selectedEditable =
    isOwner && normalizeAddress(selected?.governor) === connected

  // A list's creation is the factory's NewGTCR block time (cached once read;
  // the same query as Browse), never its first request: until the time is
  // known, the date waits. Stake lists carry their own creation time.
  const creation = useQuery({
    queryKey: ['registryCreationTimes'],
    queryFn: () => fetchRegistryCreationTimes(SUPPORTED_CHAIN_IDS),
    staleTime: 10 * 60_000,
  })
  const createdAt = (registry: GovernedRegistry): number | undefined =>
    registry.kind === 'permanent'
      ? registry.createdAt
      : (creation.data?.get(
          `${registry.chainId}:${registry.address.toLowerCase()}`,
        ) ?? (registry.createdAtExact ? registry.createdAt : undefined))

  return (
    <section aria-label="Governed lists">
      <GovHead>
        <h2>
          Governed lists
          {!loading && registries.length > 0 && (
            <small>{formatInt(registries.length)}</small>
          )}
        </h2>
        <p>
          {isZero && registries.length > 0
            ? 'Lists whose governor is the zero address: nobody can change their parameters any more.'
            : 'Lists whose governor is this address. Only the governor wallet can change their deposits, periods, court and policy.'}
        </p>
      </GovHead>

      {loading ? (
        <GovList aria-busy="true">
          <Small $muted role="status">
            Scanning indexed lists for this governor…
          </Small>
          <SkeletonBlock $height="76px" style={{ borderRadius: 14 }} />
        </GovList>
      ) : (
        <GovList>
          {shown.map((registry) => {
            const editable =
              isOwner && normalizeAddress(registry.governor) === connected
            const href = `/tcr/${registry.chainId}/${registry.address}`
            return (
              <GovRow key={registry.id}>
                <ListLogo
                  uri={registry.logoURI}
                  seed={registry.address}
                  size={40}
                />
                <GovName>
                  <TitleLine>
                    <RegistryTitle to={href}>{registry.title}</RegistryTitle>
                    {registry.trustStatus === 'verified' && (
                      <VerifiedBadge size={16} />
                    )}
                  </TitleLine>
                  <Row $gap={6} $wrap>
                    <ChainChip chainId={registry.chainId} size="sm" />
                    <small>
                      {kindLabel(registry.kind)} ·{' '}
                      {truncateMiddle(registry.address)}
                    </small>
                    {editable && (
                      <Chip>
                        <StatusDot $tone="registered" aria-hidden /> You govern
                        this list
                      </Chip>
                    )}
                  </Row>
                </GovName>
                <Facts>
                  <div>
                    <Label as="dt" $tone="faint">
                      Court
                    </Label>
                    <dd>
                      <CourtDisplay registry={registry} />
                    </dd>
                  </div>
                  <div>
                    <Label as="dt" $tone="faint">
                      Entries
                    </Label>
                    <dd>{formatInt(registry.itemCount)}</dd>
                  </div>
                  <div>
                    <Label as="dt" $tone="faint">
                      Created
                    </Label>
                    <dd>
                      <CreatedValue
                        time={createdAt(registry)}
                        pending={creation.isPending}
                      />
                    </dd>
                  </div>
                </Facts>
                <GovActions>
                  {isZero ? (
                    // Nobody holds the zero address's key: there is no
                    // update to offer, only the list to open.
                    <Chip title="The governor is the zero address, so these parameters can no longer change">
                      <StatusDot $tone="neutral" aria-hidden />
                      Governance renounced
                    </Chip>
                  ) : editable ? (
                    <Button
                      type="button"
                      $variant="primary"
                      $size="sm"
                      onClick={() => setSelected(registry)}
                    >
                      Update parameters
                    </Button>
                  ) : isConnected ? (
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      disabled
                      title="Connect the governor wallet to update this list"
                    >
                      Only the governor can update
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => appKitModal?.open({ view: 'Connect' })}
                    >
                      Connect wallet to update
                    </Button>
                  )}
                  <ButtonLink to={href} $variant="ghost" $size="sm">
                    Open list
                  </ButtonLink>
                </GovActions>
              </GovRow>
            )
          })}
        </GovList>
      )}

      {selected && (
        <GovernanceDialog
          registry={selected}
          editable={selectedEditable}
          profileAddress={profileAddress}
          written={written[selected.id]}
          onWritten={(next) => recordWritten(selected, next)}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}

export default GovernancePanel
