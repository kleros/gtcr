import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPublicClient, readContracts, simulateContract } from '@wagmi/core'
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import { erc20Abi, formatEther, isAddress, zeroAddress } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import EnsureAuth from 'components/ensure-auth'
import Select from 'components/ui/Select'
import Tooltip from 'components/ui/Tooltip'
import { CurateIcon } from 'components/curate/icons'
import {
  DROP_HINT,
  DROP_REPLACE,
  FileDropVeil,
  fileDropEdge,
  useFileDrop,
} from 'components/file-drop'
import { edgeTransition, kitTransition } from 'components/ui/kit-styles'
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
  SegmentedControl,
  type SegmentOption,
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
import { formatDate } from 'utils/time'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { fetchRegistryCreationTimes } from 'utils/registry-creation'
import { parseIpfs } from 'utils/ipfs-parse'
import { request } from 'utils/indexer-request'
import { readStakeArbitrationParams } from 'utils/stake-arbitration-params'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import {
  callData,
  downloadJson,
  hasCodeQuery,
  readHasCode,
  readSafeOwners,
  safeTransactionBuilderJson,
  type ContractCall,
} from 'utils/safe-transaction'
import {
  errorToast,
  infoToast,
  reportSwitchFailure,
  successToast,
  wrapWithToast,
} from 'utils/wrap-with-toast'
import { normalizeAddress, shortAddress } from 'pages/dashboard/data'
import { entryCount } from 'pages/dashboard/view'
import { VerifiedBadge } from 'components/curate/verified-badge'
import { KindTag } from 'components/curate/stake-tag'
import {
  SUPPORTED_CHAIN_IDS,
  abiForKind,
  chainName,
  type GovernanceParams,
  type GovernedRegistry,
} from './data'
import {
  arbitrationExtraData,
  describeParsed,
  formatParamValue,
  isUnchanged,
  markListSettingsStale,
  newGovernorCodeNote,
  parseJurors,
  parseParamValue,
  type CodeCheck,
  type ParamConfig,
  type ParamContext,
  type ParamGroup,
} from './governance-params'
import { ACTIVITY_LAYOUT_OPTIONS, formatInt, type ActivityLayout } from './view'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Governed lists: the registries whose governor is the profile address, and
 * the dialog the governor uses to change one parameter at a time. The same
 * dialog opens from the list's own page (ListGovernanceDialog, mounted by
 * components/curate/list-governance.tsx). Every write is simulated first,
 * then sent through the wallet with a toast; the contract calls, Atlas
 * upload and court lookup are the same as before.
 */

/* ---------- Parameter plumbing ---------- */

/* How a value is shown, read back and checked: governance-params.ts. */

// The shared helper, so Gnosis reads "xDAI" here like everywhere else.
const nativeSymbol = (chainId: number) => getNativeCurrency(chainId).symbol

/*
 * The help lines are the factories' (factory/tcr-params.tsx and
 * factory-permanent/tcr-params.tsx), so a parameter is explained the same
 * way when a list is launched and when it is changed. The appeal stakes say
 * what the factories' shared note says, one field at a time.
 */
const APPEAL_FUNDS =
  "Whoever funded the side that wins in the end shares both sides' stakes."

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
      group: 'timing',
      help: `What the side that won the last round adds to the juror fees to appeal, as a percent of those fees. ${APPEAL_FUNDS}`,
    },
    {
      key: 'loserStakeMultiplier',
      label: 'Appeal stake, side that lost (%)',
      kind: 'multiplier',
      functionName: 'changeLoserStakeMultiplier',
      group: 'timing',
      help: `What the side that lost the last round adds to the juror fees to appeal, as a percent of those fees. ${APPEAL_FUNDS}`,
    },
    {
      key: 'sharedStakeMultiplier',
      label: 'Appeal stake, no winner (%)',
      kind: 'multiplier',
      functionName: 'changeSharedStakeMultiplier',
      group: 'timing',
      help: `What each side adds to the juror fees to appeal when the last round had no winner, as a percent of those fees. ${APPEAL_FUNDS}`,
    },
  ]
  const governor: ParamConfig = {
    key: 'governor',
    label: 'Governor address',
    kind: 'address',
    functionName: 'changeGovernor',
    group: 'advanced',
    help: 'Hands every setting of this list, the court and the policy included, to another address.',
    note: 'After it is mined, this wallet can no longer change anything.',
  }

  if (registry.kind === 'permanent')
    return [
      {
        key: 'submissionMinDeposit',
        label: `Minimum stake (${permanentTokenLabel})`,
        kind: 'token',
        functionName: 'changeSubmissionMinDeposit',
        group: 'deposits',
        help: 'The least a submitter can stake. A successful challenger takes it.',
      },
      {
        key: 'challengeStakeMultiplier',
        label: "Challenger stake (% of the entry's stake)",
        kind: 'multiplier',
        functionName: 'changeChallengeStakeMultiplier',
        group: 'deposits',
        help: "A share of the entry's stake. Back to the challenger on a win; added to the entry's stake on a loss.",
      },
      {
        key: 'submissionPeriod',
        label: 'Submission period (days)',
        kind: 'seconds',
        positive: true,
        functionName: 'changeSubmissionPeriod',
        group: 'timing',
        help: 'Unchallenged this long, a new entry counts as accepted.',
      },
      {
        key: 'reinclusionPeriod',
        label: 'Reinclusion period (days)',
        kind: 'seconds',
        functionName: 'changeReinclusionPeriod',
        group: 'timing',
        help: 'Unchallenged this long after the jurors kept it, an entry counts as accepted again.',
      },
      {
        key: 'withdrawingPeriod',
        label: 'Withdrawing period (days)',
        kind: 'seconds',
        positive: true,
        functionName: 'changeWithdrawingPeriod',
        group: 'timing',
        help: 'How long a withdrawing entry stays open to challenge before its stake can be taken back.',
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
      group: 'deposits',
      help: 'Locked by a submitter, paid to a winning challenger.',
    },
    {
      key: 'submissionChallengeBaseDeposit',
      label: `Challenge deposit, submissions (${symbol})`,
      kind: 'wei',
      functionName: 'changeSubmissionChallengeBaseDeposit',
      group: 'deposits',
      help: 'Paid to the submitter if a challenge fails; usually 0.',
    },
    {
      key: 'removalBaseDeposit',
      label: `Removal deposit (${symbol})`,
      kind: 'wei',
      functionName: 'changeRemovalBaseDeposit',
      group: 'deposits',
      help: 'Locked to remove an entry, paid to a winning challenger.',
    },
    {
      key: 'removalChallengeBaseDeposit',
      label: `Challenge deposit, removals (${symbol})`,
      kind: 'wei',
      functionName: 'changeRemovalChallengeBaseDeposit',
      group: 'deposits',
      help: 'Paid to the requester if a removal challenge fails.',
    },
    {
      key: 'challengePeriodDuration',
      label: 'Challenge period (days)',
      kind: 'seconds',
      positive: true,
      functionName: 'changeChallengePeriodDuration',
      group: 'timing',
      help: 'How long a request can be challenged before it is accepted.',
    },
    ...appealStakes,
    {
      key: 'connectedTCR',
      label: 'Badges list (connected TCR) address',
      kind: 'address',
      functionName: 'changeConnectedTCR',
      group: 'advanced',
      help: "The list that holds badges for this list's entries. Use the zero address to disconnect it.",
    },
    {
      key: 'relayerContract',
      label: 'Relayer contract address',
      kind: 'address',
      functionName: 'changeRelayerContract',
      group: 'advanced',
      help: 'A relayer can add and remove entries directly, with no deposit and no challenge period. Keep the zero address unless you run one.',
    },
    governor,
  ]
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
 * court also sends the MetaEvidence (Standard and Stake), and a file the indexer
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
  /** The arbitrator new requests use (Standard). */
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

/**
 * A MetaEvidence URI in the form the list stores. Every reader of the list
 * puts the IPFS gateway in front of the stored value, so a gateway link
 * (https://<host>/ipfs/<cid>/…) or an ipfs:// URI is stored as the /ipfs/
 * path it points to. An /ipfs/ path is kept exactly as typed.
 */
const toStoredUri = (text: string) =>
  text
    .trim()
    .replace(/^(?:ipfs:\/\/|https?:\/\/[^/?#]+\/ipfs\/)(?=[^/?#])/i, '/ipfs/')

const isWebAddress = (uri: string) => /^https?:\/\//i.test(uri.trim())

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
  // The values come in stored form (toStoredUri): a web address left now is
  // not an IPFS file, and no reader could open the list until another save.
  if ([registration, clearing].some((uri) => uri && isWebAddress(uri)))
    return "MetaEvidence must be on IPFS: Curate reads it only through the IPFS gateway, so a web address would break the list. Use Upload JSON, or enter the file's /ipfs/… path."
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
 * and how many times the MetaEvidence has changed. Standard's getters return
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

const STANDARD_META_EVIDENCE = `
  query GovernanceStandardMetaEvidence($id: String!) {
    registry: LRegistry_by_pk(id: $id) {
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
 * only if it is at the chain's change count: Standard emits two MetaEvidence
 * logs per settings entry (metaEvidenceUpdates is the number of entries),
 * and the Stake subgraph keys each settings entry by its index. Otherwise
 * the result is `behind`, or `unreadable` when the indexer did not answer:
 * the saves refuse until it is current, since each sends MetaEvidence.
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
      }>(url, STANDARD_META_EVIDENCE, { id }).catch(() => undefined)
    : undefined
  const indexed = answer?.registry
  if (!indexed) return { ...chain, unreadable: true }
  const current = Number(indexed.metaEvidenceCount) === 2 * chain.changes
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

/**
 * How often the dialog reads the settings again while the indexer trails
 * the chain or does not answer (the two notes below say 15 seconds).
 */
const REREAD_MS = 15_000
const CURRENT_UNREADABLE =
  "The list's current settings could not be read. Close and reopen this dialog to try again."
const META_EVIDENCE_UNREADABLE =
  "The list's current MetaEvidence could not be read from the indexer. This dialog tries again every 15 seconds."
const INDEXER_BEHIND =
  "The indexer has not caught up with this list's latest MetaEvidence yet, so this dialog can't start from the live files. It checks again every 15 seconds."
const SETTINGS_CHANGED =
  "This list's settings changed since this dialog opened, so nothing was sent. The form now shows the live settings: make your change again."

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

/*
 * The dialog fits the window: it is a column capped at the window's height
 * (less the layer's gutters), whose head stays put (the title, the close
 * button, what stops a save and the sections) while only the body scrolls.
 * Round 5 measured the old one at about 2,000px on a 900px window: the
 * layer scrolled the whole dialog, so the title and the close button left
 * the screen and mid-scroll nothing said which list or section was open.
 * The layer keeps its own scroll only as a fallback.
 *
 * It hangs from a fixed top, not the middle: the sections differ in height,
 * and a centred dialog moved its own section control under the pointer at
 * every switch. Only the bottom edge moves now.
 */
const Layer = styled.div`
  --layer-top: clamp(32px, 8vh, 96px);
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--layer-top) 16px 32px;
  overflow-y: auto;

  @media (max-width: 720px) {
    align-items: flex-end;
    padding: 0;
  }
`

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  /* A solid fill first: a browser without color-mix() (iOS before 16.2,
     Chrome before 111) drops the next line and keeps this one. */
  background: var(--stage);
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
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 760px;
  /* vh first, for a browser without dynamic viewport units. */
  max-height: calc(100vh - var(--layer-top) - 32px);
  max-height: calc(100dvh - var(--layer-top) - 32px);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  outline: none;
  animation: ${dialogIn} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;

  /* A sheet from the bottom edge, short of the top so the page behind
     still shows (and closes it); dvh follows the phone's own bars. Its
     height is fixed, so its head (the sections) stays put whichever
     section is open. */
  @media (max-width: 720px) {
    max-width: none;
    height: 92vh;
    height: 92dvh;
    max-height: none;
    border-radius: 24px 24px 0 0;
    animation: ${sheetIn} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/* The section control keeps its own width: stretched across the head, its
   recessed track was half empty to the right of the last option. The title
   row and the gate lines still span the head. */
const DialogHead = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--glass-border);

  > [role='radiogroup'] {
    align-self: flex-start;
    max-width: 100%;
  }

  @media (max-width: 720px) {
    padding: 16px 16px 12px;
  }
`

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h3 {
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  > :first-child {
    flex: 1 1 auto;
    min-width: 0;
    padding-top: 3px;
  }

  @media (max-width: 720px) {
    h3 {
      font-size: 20px;
      line-height: 26px;
    }
  }
`

const DialogBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;

  @media (max-width: 720px) {
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  }
`

/** What Tab can land on inside the dialog; the dialog itself (tabindex -1) is excluded. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

/* ---------- Help behind a "?" ---------- */

/**
 * False inside a hidden section. A tooltip open when its section hid (the
 * pointer resting on a Save while the arrow keys switch sections) gets no
 * pointer leave, so the tooltips there start again, closed, at each switch.
 */
const SectionOpen = React.createContext(true)

/** True on a screen without hover (touch), where a tooltip never opens. */
const useHoverless = () => {
  const [hoverless, setHoverless] = useState(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(hover: none)').matches),
  )
  useEffect(() => {
    const query = window.matchMedia?.('(hover: none)')
    if (!query) return undefined
    const update = () => setHoverless(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return hoverless
}

const LabelLine = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
`

const HelpButton = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-faint);
  cursor: help;
  transition: color var(--motion);

  &:hover,
  &[aria-expanded='true'] {
    color: var(--color-text);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const HelpNote = styled(Small)`
  display: block;
  margin-top: 4px;
  color: var(--color-muted);
`

/**
 * A label with what it means one "?" away. With a pointer the shared
 * Tooltip shows it on hover or focus (portalled above the dialog, so the
 * scrolling body never clips it); on a touch screen, where a tooltip never
 * opens, the same button opens the same words under the label. The help
 * lives here, not in muted paragraphs under each field, so the dialog stays
 * short enough to read at a glance.
 */
const Labelled = ({
  about,
  help,
  children,
}: {
  /** What the help is about, for the button's name ("About …"). */
  about: string
  help?: string
  /** The label itself. */
  children: React.ReactNode
}) => {
  const hoverless = useHoverless()
  const shown = useContext(SectionOpen)
  const [open, setOpen] = useState(false)
  const noteId = useId()
  if (!help) return <div>{children}</div>
  const button = (
    <HelpButton
      type="button"
      aria-label={`About ${about}`}
      aria-expanded={hoverless ? open : undefined}
      aria-controls={hoverless && open ? noteId : undefined}
      onClick={hoverless ? () => setOpen((value) => !value) : undefined}
    >
      <CurateIcon name="help" size={14} />
    </HelpButton>
  )
  return (
    <div>
      <LabelLine>
        {children}
        {hoverless ? (
          button
        ) : (
          <Tooltip key={String(shown)} title={help} placement="top">
            {button}
          </Tooltip>
        )}
      </LabelLine>
      {hoverless && open && <HelpNote id={noteId}>{help}</HelpNote>}
    </div>
  )
}

/**
 * A button that says why it cannot be pressed. A disabled button takes no
 * focus and, in some browsers, no hover, so its reason (a native title
 * before round 5) went unseen: this one stays focusable with aria-disabled,
 * ignores the press, and shows the reason in the shared Tooltip.
 */
const ReasonedButton = ({
  reason,
  off,
  onClick,
  children,
  ...rest
}: {
  /** Why it cannot be pressed now; shown on hover and focus. */
  reason?: string
  /** Pressing does nothing (a reason, a save running, fields locked). */
  off: boolean
  onClick?: () => void
  children: React.ReactNode
  $variant?: 'primary' | 'secondary' | 'danger'
  $size?: 'sm' | 'md'
}) => {
  const shown = useContext(SectionOpen)
  return (
    <Tooltip key={String(shown)} title={off ? reason : undefined}>
      <Button
        type="button"
        aria-disabled={off || undefined}
        onClick={off ? undefined : onClick}
        {...rest}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

const DialogShell = ({
  title,
  titleHelp,
  head,
  page,
  onClose,
  children,
}: {
  title: string
  /** What the dialog does, behind the "?" beside its title. */
  titleHelp?: string
  /** Pinned under the title: what stops a save, then the sections. */
  head?: React.ReactNode
  /** The open section: a new one starts at the top of the body. */
  page?: string
  onClose: () => void
  children: React.ReactNode
}) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // The latest close handler, so the mount effect never re-runs (and never
  // steals focus from a field) when the panel re-renders behind the dialog.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [page])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Without preventScroll the focus scrolled the layer 76px on open, and
    // the title and close button started half off the screen.
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      // The wallet modal keeps its own keys while it is open over this
      // dialog: Escape there closes that modal, and Tab moves inside it.
      if (appKitModal?.isOpen()) return
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Keep Tab inside the dialog: wrap from the last field to the first
      // and back, and pull focus in if it ever lands on the page behind.
      // Fields in a hidden section have no box, and never count as the
      // first or the last.
      const dialog = dialogRef.current
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getClientRects().length > 0,
      )
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
          <TitleRow>
            <Labelled about="this dialog" help={titleHelp}>
              <Subheading id={titleId}>{title}</Subheading>
            </Labelled>
            <IconButton type="button" aria-label="Close" onClick={onClose}>
              <CurateIcon name="close" size={16} />
            </IconButton>
          </TitleRow>
          {head}
        </DialogHead>
        <DialogBody ref={bodyRef}>{children}</DialogBody>
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

const SectionBox = styled.div`
  display: flex;
  flex-direction: column;

  &[hidden] {
    display: none;
  }

  > ${Field}:first-child {
    padding-top: 0;
    border-top: 0;
  }

  > ${Field}:last-child {
    padding-bottom: 0;
  }
`

/**
 * One section of the dialog. It is hidden, never unmounted, while another
 * is open: each field keeps its typed value (and an armed governor
 * transfer) in its own state, and a look at another section must not
 * throw that away. Its first field needs no hairline above it.
 */
const Section = ({
  open,
  children,
}: {
  open: boolean
  children: React.ReactNode
}) => (
  <SectionBox hidden={!open}>
    <SectionOpen.Provider value={open}>{children}</SectionOpen.Provider>
  </SectionBox>
)

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

/*
 * What stops a save, pinned in the head so every section shows it: one
 * line with its fix beside it, never a box (the head is no panel of its
 * own).
 */
const GateLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  min-height: 32px;
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
 * How a save leaves the dialog:
 * - send: the connected wallet is the governor and signs it.
 * - propose: the connected wallet is the governor and a contract (a Safe
 *   opened through WalletConnect): the wallet answers with a Safe proposal,
 *   never a mined transaction, so nothing waits for one.
 * - export: the governor is a contract (a Safe) and the connected wallet is
 *   someone else, perhaps one of its owners: the change is built and checked
 *   the same way, then downloaded for the Safe's Transaction Builder or
 *   copied as calldata, and signed in the Safe.
 */
export type WriteMode = 'send' | 'propose' | 'export'
/** Export only: the Transaction Builder file, or the raw calldata. */
type ExportVia = 'download' | 'copy'

const WriteModeContext = createContext<WriteMode>('send')

const PROPOSED =
  'Sent from your smart wallet. If it needs more signatures, confirm it there; the list changes once it executes.'

/** The governance call a field saves, as both paths build it. */
const governanceCall = (
  registry: GovernedRegistry,
  functionName: string,
  args: unknown[],
): ContractCall => ({
  chainId: registry.chainId,
  address: registry.address as `0x${string}`,
  abi: abiForKind(registry.kind) as ContractCall['abi'],
  functionName,
  args,
})

/** Hands a built call to the Safe's owners: a file, or the calldata. */
const exportCall = async (
  registry: GovernedRegistry,
  call: ContractCall,
  via: ExportVia,
) => {
  if (via === 'copy') {
    if (!navigator.clipboard)
      throw new Error(
        'The calldata could not be copied. Download the Safe file instead.',
      )
    await navigator.clipboard
      .writeText(`to: ${call.address}\nvalue: 0\ndata: ${callData(call)}`)
      .catch(() => {
        throw new Error(
          'The calldata could not be copied. Download the Safe file instead.',
        )
      })
    successToast(
      `Calldata copied. In the Safe on ${chainName(call.chainId)}, start a transaction to ${shortAddress(call.address)} with value 0 and this data; its owners sign it there.`,
    )
    return
  }
  downloadJson(
    `${registry.title.replace(/[^\w-]+/g, '-').toLowerCase()}-${call.functionName}.json`,
    safeTransactionBuilderJson({
      call,
      safe: registry.governor ?? '',
      name: `${registry.title}: ${call.functionName}`,
      description: `${call.functionName} on ${registry.address} (${chainName(registry.chainId)}), prepared in Curate.`,
    }),
  )
  successToast(
    `Safe file downloaded. Open the Safe on ${chainName(call.chainId)}, then Apps, then Transaction Builder, and drop the file in; the Safe's owners sign it there. It carries today's values: execute it before any other change to this list.`,
  )
}

/**
 * Simulates the call (from the connected wallet, or from the governor when
 * exporting), then sends it with a toast, proposes it to the Safe, or
 * exports it; a revert or a refused signature becomes a message instead of
 * failing silently. Resolves true only once a sent transaction is mined and
 * succeeded: a proposal or an export has changed nothing yet.
 */
const useGovernanceWrite = (registry: GovernedRegistry) => {
  const mode = useContext(WriteModeContext)
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const [pending, setPending] = useState(false)
  const ready = mode === 'export' || !!walletClient
  const send = async (
    functionName: string,
    args: unknown[],
    via: ExportVia = 'download',
  ) => {
    if (!ready) return false
    setPending(true)
    try {
      const call = governanceCall(registry, functionName, args)
      if (mode === 'export') {
        // Simulated from the governor itself: a change the Safe could not
        // make is caught before its owners are asked to sign.
        await simulateContract(wagmiConfig, {
          ...call,
          account: registry.governor as `0x${string}`,
        } as any)
        await exportCall(registry, call, via)
        return false
      }
      if (!walletClient) return false
      const { request } = await simulateContract(wagmiConfig, call as any)
      // A wallet that is a contract (a Safe through WalletConnect) answers
      // with the hash of a proposal, which is never mined: waiting for it
      // would hang, then fail. Read here, so a mode still loading can't lie.
      const isContract = await queryClient
        .fetchQuery(
          hasCodeQuery(registry.chainId, walletClient.account.address),
        )
        .catch(() => {
          // Unknown: a Safe's proposal would wait for a receipt that never
          // comes, an EOA's send would show no progress. Ask again instead.
          throw new Error(
            'Could not check the connected wallet. Try again in a moment.',
          )
        })
      if (isContract) {
        await walletClient.writeContract(request)
        infoToast(PROPOSED)
        return false
      }
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
  return { ready, mode, pending, send }
}

/**
 * The save control: one Save that signs (Propose for a Safe connected as
 * the wallet), or, for a contract governor the wallet is not, the two ways
 * to hand the change to the Safe.
 */
const SaveActions = ({
  off,
  reason,
  checking,
  pending,
  armed,
  onSave,
}: {
  off: boolean
  reason?: string
  checking?: boolean
  pending: boolean
  /** A governor transfer waiting for its second click. */
  armed?: boolean
  onSave: (via?: ExportVia) => void
}) => {
  const mode = useContext(WriteModeContext)
  const variant = armed ? 'danger' : 'primary'
  if (mode !== 'export')
    return (
      <ReasonedButton
        $variant={variant}
        off={off}
        reason={reason}
        onClick={() => onSave()}
      >
        {checking
          ? 'Checking…'
          : pending
            ? 'Saving…'
            : armed
              ? 'Confirm transfer'
              : mode === 'propose'
                ? 'Propose'
                : 'Save'}
      </ReasonedButton>
    )
  return (
    <Stack $gap={6}>
      <ReasonedButton
        $variant={variant}
        off={off}
        reason={reason}
        onClick={() => onSave('download')}
      >
        {checking
          ? 'Checking…'
          : pending
            ? 'Preparing…'
            : armed
              ? 'Confirm: download'
              : 'Download Safe file'}
      </ReasonedButton>
      <ReasonedButton
        $variant="secondary"
        off={off}
        reason={reason}
        onClick={() => onSave('copy')}
      >
        Copy calldata
      </ReasonedButton>
    </Stack>
  )
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

const UriRow = styled.div<{ $over?: boolean; $refusing?: boolean }>`
  --edge-angle: 210deg;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  /* Transparent at rest: the hairline only appears under a dragged file,
     and the row keeps its measure in every state. */
  padding: 4px;
  margin: -4px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  transition:
    ${kitTransition('border-color', 'background', 'box-shadow')},
    ${edgeTransition};

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }

  ${fileDropEdge}
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
  const { uploadFile, isVerified } = useAtlasProvider()
  const { isConnected } = useAccount()
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

  /*
   * A file dropped on the row goes through the same `upload`: the same JSON
   * rule, the same toast when it fails and the same Atlas upload when it
   * passes. Dragged text still lands in the field, since only drags that
   * carry files are claimed. The drop meets the gate the Upload button sits
   * behind (EnsureAuth: a connected wallet, then the Atlas sign-in), so a
   * governor who has not signed in is told so while the file is held,
   * instead of a generic failure after it is dropped.
   */
  const drop = useFileDrop<HTMLDivElement>({
    blocked: disabled
      ? 'This field is locked.'
      : !isConnected
        ? 'Connect first to upload the MetaEvidence file.'
        : !isVerified
          ? 'Sign in first to upload the MetaEvidence file.'
          : uploading
            ? 'An upload is already going.'
            : '',
    onFile: (file) => {
      void upload(file)
    },
    onRefuse: errorToast,
  })

  return (
    <Stack $gap={4}>
      <Label as="label" htmlFor={id}>
        {label}
      </Label>
      <UriRow $over={drop.over} $refusing={!!drop.refusal} {...drop.handlers}>
        {drop.over && (
          <FileDropVeil $refusing={!!drop.refusal}>
            {drop.refusal || (value ? DROP_REPLACE : DROP_HINT)}
          </FileDropVeil>
        )}
        <TextInput
          id={id}
          value={value}
          disabled={disabled || uploading}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="/ipfs/…"
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
  refreshing,
  gate,
  onSaved,
  onOutdated,
}: {
  registry: GovernedRegistry
  /** The live settings; undefined while they load or if they can't be read. */
  current: CurrentMetaEvidence | undefined
  /** The live settings could not be read. */
  currentError?: boolean
  /** The live settings are being read again after a change. */
  refreshing?: boolean
  gate: SaveGate
  /** Records the save; resolves once the live settings are read again. */
  onSaved: (written: Written) => Promise<unknown>
  /** The chain changed since `current` was read: read it again. */
  onOutdated: () => void
}) => {
  const { ready, pending, send } = useGovernanceWrite(registry)
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
  // Whether that edit was to the court or the jurors: until one is, a save
  // sends the list's extra data back as it is (arbitrationExtraData).
  const [courtEdited, setCourtEdited] = useState(false)
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

  const usesPair = registry.kind === 'standard'
  const usesSingle = registry.kind === 'permanent'
  const arbitratorChanged =
    registry.kind !== 'permanent' &&
    arbitrator.toLowerCase() !== currentArbitrator.toLowerCase()
  const { value: extraData, error: courtError } = arbitrationExtraData({
    current: currentExtraData,
    courtID,
    jurors,
    courtEdited,
    arbitratorChanged,
  })
  const changed =
    arbitratorChanged ||
    (extraData !== undefined &&
      extraData.toLowerCase() !== currentExtraData.toLowerCase()) ||
    toStoredUri(meta.registration) !==
      toStoredUri(current?.registration ?? '') ||
    (usesPair &&
      toStoredUri(meta.clearing) !== toStoredUri(current?.clearing ?? ''))
  // Every save sends values the governor did not touch along with the ones
  // they did (Standard and Stake send the court and the MetaEvidence together):
  // without the live values, refuse rather than send stale ones back.
  const inputError =
    !current || refreshing
      ? currentError
        ? CURRENT_UNREADABLE
        : 'Reading the current settings…'
      : current.unreadable
        ? META_EVIDENCE_UNREADABLE
        : current.behind
          ? INDEXER_BEHIND
          : registry.kind !== 'permanent' && !isAddress(arbitrator)
            ? 'Enter a valid arbitrator address'
            : courtError
  const blocker =
    gate.blocker ??
    (!ready
      ? 'Wallet not ready'
      : (inputError ?? (changed ? undefined : 'No change')))
  // The inputs wait for the live settings, and for each read after a
  // change, so no edit starts from the scan's values or from older ones.
  const locked =
    Boolean(gate.blocker) || pending || checking || !current || refreshing

  const save = async (via?: ExportVia) => {
    if (blocker || !extraData || !current) return
    // Left alone, the arbitrator goes back as the chain returned it, like
    // the extra data.
    const sentArbitrator = arbitratorChanged
      ? arbitrator
      : (current.arbitrator ?? arbitrator)
    const registration = toStoredUri(meta.registration)
    const clearing = toStoredUri(meta.clearing)
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
      // request (every arbitration cost read reverts) until it is fixed. An
      // EIP-7702 delegated account is a wallet, not an arbitrator.
      if (
        arbitratorChanged &&
        !(await readHasCode(registry.chainId, arbitrator))
      )
        return `There is no contract at ${arbitrator} on ${chainName(registry.chainId)}, so it cannot arbitrate.`
      return checkMetaEvidence({
        registration,
        clearing: usesPair ? clearing : undefined,
        current,
      })
    })().catch(() => 'The checks before saving failed. Try again.')
    if (!alive.current) return
    setChecking(false)
    if (outdated) {
      // Every field goes back to the live values, read again now: an edit
      // kept would hold its untouched neighbours on the older values, and
      // the next save would send them back.
      meta.reset()
      setSettingsEdited(false)
      setCourtEdited(false)
      onOutdated()
    }
    if (problem) {
      errorToast(problem)
      return
    }
    const functionName = 'changeArbitrationParams'
    const args =
      registry.kind === 'standard'
        ? [sentArbitrator, extraData, registration, clearing]
        : [extraData, registration]
    if (await send(functionName, args, via)) {
      // Standard and Stake add a settings entry: one more MetaEvidence change.
      const changes = (current.changes ?? 0) + 1
      // The fields keep the saved values until the live settings are read
      // again: un-edited sooner, they would show the ones from before.
      await onSaved({
        params: {
          ...(registry.kind !== 'permanent'
            ? { arbitrator: sentArbitrator }
            : {}),
          arbitratorExtraData: extraData,
          ...(usesSingle ? { metaEvidenceURI: registration } : {}),
        },
        metaEvidence: usesPair
          ? { registration, clearing, changes }
          : { registration, changes },
      })
      if (!alive.current) return
      meta.reset()
      setSettingsEdited(false)
      setCourtEdited(false)
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
      <Labelled
        about="the court and the MetaEvidence"
        help={
          registry.kind === 'standard'
            ? 'Standard Curate changes the court together with both MetaEvidence files. They start on the live files: keep them to change only the court, or upload new ones (same columns) to change the policy too.'
            : 'Stake Curate changes the court together with its MetaEvidence. It starts on the live file: keep it to change only the court.'
        }
      >
        <FieldLabel as="div">
          {registry.kind === 'permanent'
            ? 'Court and MetaEvidence'
            : 'Arbitrator and court'}
        </FieldLabel>
      </Labelled>
      <Controls>
        <Stack $gap={8}>
          {registry.kind !== 'permanent' && (
            <TextInput
              value={arbitrator}
              disabled={locked}
              onChange={(event) => {
                setSettingsEdited(true)
                // A pasted address often brings a space along: drop it.
                setArbitrator(event.currentTarget.value.trim())
              }}
              placeholder="Arbitrator address"
              aria-label="Arbitrator address"
            />
          )}
          <TwoUp>
            <Stack $gap={4}>
              {/* The court's purpose sits behind its "?"; the fee per juror
                  stays in view below, since it is money. */}
              <Labelled
                about={selectedCourt?.label ?? 'the court'}
                help={
                  selectedCourt
                    ? selectedCourt.summary ||
                      `${selectedCourt.label} handles disputes sent to this court.`
                    : undefined
                }
              >
                <Label
                  as="label"
                  id={`${ids}-court-label`}
                  htmlFor={`${ids}-court`}
                >
                  Court
                </Label>
              </Labelled>
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
                  setCourtEdited(true)
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
                  setCourtEdited(true)
                  setJurors(event.currentTarget.value)
                }}
                placeholder="Number of jurors"
                inputMode="numeric"
                // Only a count being sent can be wrong: the list's own is
                // sent back as it is, whatever it is.
                aria-invalid={
                  courtError !== undefined && Boolean(parseJurors(jurors).error)
                }
              />
            </Stack>
          </TwoUp>
          {selectedCourt && (
            <Small $muted>
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
        <SaveActions
          off={Boolean(blocker || locked)}
          reason={blocker}
          checking={checking}
          pending={pending}
          onSave={(via) => void save(via)}
        />
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
  const { ready, mode, pending, send } = useGovernanceWrite(registry)
  const inputId = useId()
  const noteId = useId()
  const current = registry.params?.[config.key]
  const initial = formatParamValue(current, config.kind, context)
  const [value, setValue] = useState(initial)
  const [edited, setEdited] = useState(false)
  // A governor transfer takes a second, deliberate click.
  const [armed, setArmed] = useState(false)
  // Whether the new governor is a contract on this chain, with the address
  // it was read for; undefined until read.
  const [governorCheck, setGovernorCheck] = useState<CodeCheck>()
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
    (!ready
      ? 'Wallet not ready'
      : (inputError ?? (unchanged ? 'No change' : undefined)))
  const locked = Boolean(gate.blocker) || pending
  const description = describeParsed(parsed, config.kind)

  const save = async (via?: ExportVia) => {
    if (blocker || parsed.error !== undefined) return
    if (isGovernor && !armed) {
      setArmed(true)
      // readHasCode counts an EIP-7702 delegated account as the wallet it
      // is, as the rest of the app does once that address governs.
      readHasCode(registry.chainId, target)
        .then((contract) => setGovernorCheck({ address: target, contract }))
        .catch(() => setGovernorCheck({ address: target, contract: null }))
      return
    }
    if (await send(config.functionName, [parsed.value], via)) {
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
      <Labelled about={config.label} help={config.help}>
        <FieldLabel htmlFor={inputId}>{config.label}</FieldLabel>
      </Labelled>
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
                .{' '}
                {mode === 'send'
                  ? 'After it is mined, only that address can change the list.'
                  : 'Once the Safe executes it, only that address can change the list.'}
                {newGovernorCodeNote(
                  governorCheck,
                  target,
                  chainName(registry.chainId),
                )}
              </Small>
            </GateRow>
          )}
        </Stack>
        <SaveActions
          off={Boolean(blocker) || locked}
          reason={blocker}
          pending={pending}
          armed={armed}
          onSave={(via) => void save(via)}
        />
      </Controls>
      {config.note && <Small $muted>{config.note}</Small>}
    </Field>
  )
}

/* ---------- Update dialog ---------- */

/**
 * The dialog's sections, in order: the court (with the MetaEvidence it is
 * saved with), the money, the clocks, and the rest. Stake calls the money
 * section "Stake", its own word for what a submitter locks.
 */
type GovernanceSection = 'court' | ParamGroup
const PARAM_GROUPS: ParamGroup[] = ['deposits', 'timing', 'advanced']

const GovernanceDialog = ({
  registry,
  mode,
  profileAddress,
  written,
  onWritten,
  onClose,
}: {
  /** The list, with this page's saved params already laid over it. */
  registry: GovernedRegistry
  /** How a save leaves (see WriteMode); undefined: nothing can be saved. */
  mode?: WriteMode
  profileAddress: string
  /** What this page's saves wrote to the list (see Written). */
  written?: Written
  onWritten: (written: Written) => void
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [section, setSection] = useState<GovernanceSection>('court')
  const { address: account, chainId: walletChainId, isConnected } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const exporting = mode === 'export'
  // An export signs nothing here: the wallet's chain does not matter.
  const wrongChain = !!mode && !exporting && walletChainId !== registry.chainId
  // Exporting: whether the wallet is one of the Safe's owners, to say who
  // signs next. Undefined while read, or when the governor is no Safe.
  const owners = useQuery({
    queryKey: ['safeOwners', registry.chainId, registry.governor],
    queryFn: () =>
      readSafeOwners(registry.chainId, registry.governor ?? '').then(
        (list) => list ?? null,
      ),
    enabled: exporting && !!registry.governor,
    staleTime: 60_000,
  })
  const safeNote = !exporting
    ? undefined
    : `${registry.title} is governed by ${
        owners.data ? 'a Safe' : 'a contract'
      } (${shortAddress(registry.governor ?? '')}) on ${chainName(registry.chainId)}, so no wallet signs here. Prepare a change, then download it for the Safe's Transaction Builder or copy its calldata. ${
        !owners.data
          ? "The contract's signers approve it there."
          : owners.data.includes(normalizeAddress(account))
            ? 'You are one of its owners: sign it in the Safe, and the other owners confirm it.'
            : 'This wallet is not one of its owners: pass the change to one who is.'
      }`
  const gate: SaveGate = !mode
    ? { blocker: 'Only the governor wallet can save changes' }
    : wrongChain
      ? {
          blocker: `Switch to ${chainName(registry.chainId)} to save`,
          helper: {
            label: `Switch to ${chainName(registry.chainId)}`,
            onClick: () =>
              switchChain(
                { chainId: registry.chainId },
                {
                  onError: (err) =>
                    reportSwitchFailure(err, chainName(registry.chainId)),
                },
              ),
            loading: switching,
          },
        }
      : {}
  // wagmi keys the wallet client by useChainId(), so a wallet back from a
  // chain the app does not configure keeps the lookup that failed there, and
  // every Save would stay disabled: look it up again then, as list pages do
  // (hooks/use-tcr-network.ts). Read without fetching: the fields fetch it.
  const {
    data: walletClient,
    isError: walletClientFailed,
    refetch: refetchWalletClient,
  } = useWalletClient({ query: { enabled: false } })
  const onListChain = isConnected && walletChainId === registry.chainId
  useEffect(() => {
    if (onListChain && walletClientFailed)
      void refetchWalletClient({ cancelRefetch: false })
  }, [onListChain, walletClientFailed, refetchWalletClient])
  // After a court or MetaEvidence save, and after a save refused because the
  // settings changed, the live settings are read again. The settings fields
  // wait for that read, so no edit starts from the values read before.
  const [rereads, setRereads] = useState(0)
  const waitForRead = async (read: Promise<unknown>) => {
    setRereads((count) => count + 1)
    try {
      await read
    } finally {
      setRereads((count) => count - 1)
    }
  }
  const saved = (next: Written) => {
    onWritten(next)
    void queryClient.invalidateQueries({
      queryKey: ['addressProfile', profileAddress],
    })
    // The list page and the other pages that keep its MetaEvidence for a
    // day read it again when next shown, not the file from before the save.
    void markListSettingsStale(queryClient, registry)
    return queryClient.invalidateQueries({
      queryKey: ['governanceMetaEvidence', registry.chainId, registry.address],
    })
  }
  const savedSettings = (next: Written) => waitForRead(saved(next))
  // The list's live settings, read again each time the dialog opens, and
  // every REREAD_MS while the indexer trails the chain or does not answer,
  // so that waiting is enough.
  const metaEvidence = useQuery({
    queryKey: ['governanceMetaEvidence', registry.chainId, registry.address],
    queryFn: () => fetchCurrentMetaEvidence(registry),
    staleTime: 0,
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.behind || query.state.data?.unreadable
        ? REREAD_MS
        : false,
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
  // A failed read keeps the previous answer in the cache, from before a
  // save perhaps: the settings fields show the failure, not older values.
  const liveSettings = metaEvidence.isError ? undefined : currentMetaEvidence
  const metaEvidenceError = metaEvidence.isError
  const readSettingsAgain = () => void waitForRead(metaEvidence.refetch())
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

  const params = editableParams(registry)
  const sections: SegmentOption<GovernanceSection>[] = [
    { value: 'court', label: 'Court' },
    {
      value: 'deposits',
      label: registry.kind === 'permanent' ? 'Stake' : 'Deposits',
    },
    { value: 'timing', label: 'Timing & appeals' },
    { value: 'advanced', label: 'Advanced' },
  ]

  return (
    <DialogShell
      title={`Update ${registry.title}`}
      titleHelp={
        exporting
          ? "Changes are prepared one parameter at a time. Each is simulated as the governor before you download it, so a change that would revert is caught before the Safe's owners sign it."
          : 'Changes are sent one parameter at a time. Each is simulated before the wallet asks you to sign, so a change that would revert is caught before you pay gas.'
      }
      page={section}
      onClose={onClose}
      head={
        <>
          {gate.blocker && (
            <GateLine>
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
            </GateLine>
          )}
          {safeNote && (
            <GateLine>
              <Small $muted role="status">
                {safeNote}
              </Small>
            </GateLine>
          )}
          {!gate.blocker &&
            !exporting &&
            walletClientFailed &&
            !walletClient && (
              <GateLine>
                <Small $muted role="status">
                  Wallet not ready: reconnect it or reload the page to save
                  changes.
                </Small>
              </GateLine>
            )}
          <SegmentedControl<GovernanceSection>
            ariaLabel="Settings section"
            size="sm"
            value={section}
            onChange={setSection}
            options={sections}
          />
        </>
      }
    >
      <WriteModeContext.Provider value={mode ?? 'send'}>
        <Section open={section === 'court'}>
          <ArbitrationGovernanceField
            registry={registry}
            current={liveSettings}
            currentError={metaEvidenceError}
            refreshing={rereads > 0}
            gate={gate}
            onSaved={savedSettings}
            onOutdated={readSettingsAgain}
          />
        </Section>
        {PARAM_GROUPS.map((group) => (
          <Section key={group} open={section === group}>
            {params
              .filter((config) => config.group === group)
              .map((config) => (
                <GovernanceField
                  key={`${registry.id}-${config.key}`}
                  registry={withIndexedParams}
                  config={config}
                  context={context}
                  gate={gate}
                  onSaved={saved}
                />
              ))}
          </Section>
        ))}
      </WriteModeContext.Provider>
    </DialogShell>
  )
}

/**
 * How the connected wallet can save to a list: as its governor (a Safe
 * connected as the wallet proposes), by export when the governor is a
 * contract it is not, or not at all.
 */
const writeModeFor = (
  connected: string,
  governor: string | undefined,
  contractGovernor: boolean | undefined,
): WriteMode | undefined => {
  const target = normalizeAddress(governor)
  if (!connected || !target || target === zeroAddress) return undefined
  if (connected === target) return contractGovernor ? 'propose' : 'send'
  return contractGovernor ? 'export' : undefined
}

/**
 * The update dialog for one list, opened from the list's own page
 * (components/curate/list-governance.tsx), with what its saves wrote laid
 * over the list until the next read. The connected governor saves; when
 * the governor is a contract (a Safe), any connected wallet prepares a
 * change for it instead; anyone else (a wallet that changed since the
 * button showed) sees the dialog's gate. A governor transfer ends this
 * wallet's say over the list, so it closes the dialog.
 */
export const ListGovernanceDialog = ({
  registry,
  onSaved,
  onClose,
}: {
  /** The list with its governor and parameters, read for its page. */
  registry: GovernedRegistry
  /** A save went through: read the list again. */
  onSaved?: () => void
  onClose: () => void
}) => {
  const { address } = useAccount()
  const connected = normalizeAddress(address)
  const [written, setWritten] = useState<Written>()
  const shown = withWritten(registry, written)
  const contractGovernor = useQuery(
    hasCodeQuery(shown.chainId, shown.governor),
  ).data
  return (
    <GovernanceDialog
      registry={shown}
      mode={writeModeFor(connected, shown.governor, contractGovernor)}
      profileAddress={connected}
      written={written}
      onWritten={(next) => {
        setWritten((previous) => mergeWritten(previous, next))
        onSaved?.()
        if (next.params?.governor) {
          successToast(`${registry.title} has a new governor.`)
          onClose()
        }
      }}
      onClose={onClose}
    />
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

/* Fixed columns for the figures, so Entries and Created line up down the
   list whatever the width of each row's court: 52px holds the ENTRIES label
   and six figures, 84px the longest date ("30 Sept 2023"), and the court
   keeps the rest. */
const Facts = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px 84px;
  gap: 4px 20px;
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

  /* The court ("xDai Curation (Hidden Voting) · ID 19 · 3 jurors") wraps to
     a second line where its column narrows, rather than losing its end. */
  div:first-child dd {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: normal;
  }

  @media (max-width: 560px) {
    grid-template-columns: 52px minmax(0, 1fr);

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

/*
 * Cards (round 6: "the card view also for governed lists"): the Browse
 * card's shape, with the governor's controls at its foot. Three across at
 * 1440, so six lists make two full rows.
 */
const GovGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const GovCard = styled.li`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
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
`

const CardTop = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

/* The court under the name, on its own lines: a card has the room. */
const CardCourt = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* Entries large on the left, the creation date on the right, as on Browse. */
const CardStats = styled.dl`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: auto 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);

  div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  div + div {
    align-items: flex-end;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-variant-numeric: tabular-nums;
  }

  dd[data-big] {
    font-family: var(--font-figure);
    font-size: 28px;
    line-height: 30px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }
`

const CardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  > :first-child {
    flex: 1 1 auto;
  }
`

/* The intro line and the layout control (icons only, as on Activity). */
const GovToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  margin: 0 0 16px;

  > p {
    margin: 0;
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

/* Under the profile's tabs, which name the section: the one line that says
   what these lists are, then the rows. */
const GovIntro = styled.p`
  margin: 0 0 16px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
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
  embedded = false,
  layout = 'rows',
  onLayout,
}: {
  registries: GovernedRegistry[]
  profileAddress: string
  loading?: boolean
  /** Cards or rows: the profile's one layout, shared with its Activity. */
  layout?: ActivityLayout
  onLayout?: (layout: ActivityLayout) => void
  /** The zero address: its lists can no longer change parameters. */
  isZero?: boolean
  /**
   * Under the profile's tabs, which name the section and count its lists:
   * no heading of its own, only the line that says what the lists are.
   */
  embedded?: boolean
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
  // Whether this address is a contract (most often a Safe) on each chain it
  // governs lists on: a getCode per chain, from the chain's RPC. Its owners
  // never connect as it, so any connected wallet prepares changes for it.
  const governedChains = useMemo(
    () => [...new Set(registries.map((registry) => registry.chainId))],
    [registries],
  )
  const contractOn = useQueries({
    queries: governedChains.map((chainId) => {
      const query = hasCodeQuery(chainId, profileAddress)
      return { ...query, enabled: query.enabled && !isZero }
    }),
  })
  const isContractOn = (chainId: number) =>
    contractOn[governedChains.indexOf(chainId)]?.data
  const anyContract = contractOn.some((query) => query.data)
  // How the connected wallet saves to a list this address still governs.
  const modeFor = (registry: GovernedRegistry) =>
    isConnected && normalizeAddress(registry.governor) === profileAddress
      ? writeModeFor(
          connected,
          registry.governor,
          isContractOn(registry.chainId),
        )
      : undefined
  const selectedMode = selected ? modeFor(selected) : undefined

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

  const intro =
    isZero && registries.length > 0
      ? 'Lists whose governor is the zero address: nobody can change their parameters any more.'
      : anyContract
        ? "Lists whose governor is this address, a Safe or another contract. Any connected wallet can prepare a change to their deposits, periods, court and policy; the Safe's owners sign it there."
        : 'Lists whose governor is this address. Only the governor wallet can change their deposits, periods, court and policy.'

  const layoutControl =
    onLayout && !loading && registries.length > 0 ? (
      <SegmentedControl<ActivityLayout>
        ariaLabel="Layout"
        size="sm"
        value={layout}
        onChange={onLayout}
        options={ACTIVITY_LAYOUT_OPTIONS}
      />
    ) : null

  // What every layout shows of a list: who it is, and what its governor can
  // do with it.
  const identity = (registry: GovernedRegistry, editable: boolean) => {
    const href = `/tcr/${registry.chainId}/${registry.address}`
    return (
      <GovName>
        <TitleLine>
          <RegistryTitle to={href}>{registry.title}</RegistryTitle>
          {registry.trustStatus === 'verified' && <VerifiedBadge size={16} />}
          <KindTag kind={registry.kind} />
        </TitleLine>
        <Row $gap={6} $wrap>
          <ChainChip chainId={registry.chainId} size="sm" />
          <small>{truncateMiddle(registry.address)}</small>
          {editable && (
            <Chip>
              <StatusDot $tone="registered" aria-hidden /> You govern this list
            </Chip>
          )}
        </Row>
      </GovName>
    )
  }
  const controls = (registry: GovernedRegistry, mode?: WriteMode) => {
    const href = `/tcr/${registry.chainId}/${registry.address}`
    const editable = mode === 'send' || mode === 'propose'
    return (
      <>
        {isZero ? (
          // Nobody holds the zero address's key: there is no update to
          // offer, only the list to open.
          <Chip title="The governor is the zero address, so these parameters can no longer change">
            <StatusDot $tone="neutral" aria-hidden />
            Governance renounced
          </Chip>
        ) : editable ? (
          // The list page's button says the same, so the governor meets
          // one name in both places.
          <Button
            type="button"
            $variant="primary"
            $size="sm"
            onClick={() => setSelected(registry)}
          >
            Update list parameters
          </Button>
        ) : mode === 'export' ? (
          // A Safe's owners never connect as the Safe: they prepare the
          // change here and sign it in the Safe.
          <Tooltip title="The governor is a Safe: prepare a change here, then sign it in the Safe.">
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => setSelected(registry)}
            >
              Update list parameters
            </Button>
          </Tooltip>
        ) : isConnected ? (
          <ReasonedButton
            $variant="secondary"
            $size="sm"
            off
            reason="Connect the governor wallet to update this list"
          >
            Only the governor can update
          </ReasonedButton>
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
      </>
    )
  }

  return (
    <section aria-label="Governed lists">
      {embedded ? (
        <GovToolbar>
          <GovIntro>{intro}</GovIntro>
          {layoutControl}
        </GovToolbar>
      ) : (
        <GovHead>
          <h2>
            Governed lists
            {!loading && registries.length > 0 && (
              <small>{formatInt(registries.length)}</small>
            )}
          </h2>
          {layoutControl}
          <p>{intro}</p>
        </GovHead>
      )}

      {loading ? (
        <GovList aria-busy="true">
          <Small $muted role="status">
            Scanning indexed lists for this governor…
          </Small>
          <SkeletonBlock $height="76px" style={{ borderRadius: 14 }} />
        </GovList>
      ) : layout === 'cards' ? (
        <GovGrid key="cards">
          {shown.map((registry) => {
            const mode = modeFor(registry)
            const editable = mode === 'send' || mode === 'propose'
            return (
              <GovCard key={registry.id}>
                <CardTop>
                  <ListLogo
                    uri={registry.logoURI}
                    seed={registry.address}
                    size={40}
                  />
                  {identity(registry, editable)}
                </CardTop>
                <CardCourt>
                  <Label $tone="faint">Court</Label>
                  <span>
                    <CourtDisplay registry={registry} />
                  </span>
                </CardCourt>
                <CardStats>
                  <div>
                    <Label as="dt" $tone="faint">
                      Entries
                    </Label>
                    {/* Every entry, open requests included: the list
                        page's and Browse's Entries. */}
                    <dd data-big>{formatInt(entryCount(registry))}</dd>
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
                </CardStats>
                <CardActions>{controls(registry, mode)}</CardActions>
              </GovCard>
            )
          })}
        </GovGrid>
      ) : (
        <GovList key="rows">
          {shown.map((registry) => {
            const mode = modeFor(registry)
            const editable = mode === 'send' || mode === 'propose'
            return (
              <GovRow key={registry.id}>
                <ListLogo
                  uri={registry.logoURI}
                  seed={registry.address}
                  size={40}
                />
                {identity(registry, editable)}
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
                    {/* Every entry, open requests included: the list
                        page's and Browse's Entries. */}
                    <dd>{formatInt(entryCount(registry))}</dd>
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
                <GovActions>{controls(registry, mode)}</GovActions>
              </GovRow>
            )
          })}
        </GovList>
      )}

      {selected && (
        <GovernanceDialog
          registry={selected}
          mode={selectedMode}
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
