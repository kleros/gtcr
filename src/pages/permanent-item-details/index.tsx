import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from 'react'
import styled from 'styled-components'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ethers, BigNumber } from 'ethers'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import useArbitrationCost from 'hooks/arbitration-cost'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { useAttachment } from 'hooks/use-attachment'
import { WalletContext } from 'contexts/wallet-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import {
  PERMANENT_ITEM_DETAILS_QUERY,
  PERMANENT_REGISTRY_QUERY,
} from 'utils/graphql'
import { STALE_TIME } from 'consts'
import { isKlerosArbitrator } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { type ItemFile, sanitizeItemFile } from 'utils/item-file-guard'
import { sanitizeMetaEvidence } from 'utils/meta-evidence-guard'
import { capitalizeFirstLetter } from 'utils/string'
import { CONTRACT_STATUS } from 'utils/permanent-item-status'
import { truncateAtWord } from 'utils/truncate-at-word'
import { formatDurationLong } from 'utils/time'
import RequestTimelines from 'components/permanent-request-timelines'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ChainChip,
  Label,
  Page,
  SkeletonBlock,
  Surface,
} from 'components/curate/primitives'
import { EntryStatus, stakeEntryStatus } from 'components/curate/entry-status'
import { Explainer } from 'components/curate/explainer'
import { reveal } from 'components/curate/motion/reveal'
import {
  FieldValue,
  hasValue,
  titleField,
  type EntryField,
} from 'components/curate/item-standard-fields'
import { StickyActionBarSpacer } from 'components/curate/item-standard-action-bar'
import ErrorPage from '../error-page'
import {
  ENTRY_LINK_TIP,
  ENTRY_LOAD_FAILED,
  ENTRY_INDEXING_MESSAGE,
  ENTRY_INDEXING_TITLE,
  ENTRY_MISSING_TIP,
  justSubmitted,
  missingEntryPollMs,
} from '../error-page/copy'
import ItemStatusCard from './item-status-card'
import { StakeWindowPanel } from './item-window'
import { ItemSubmissionPanel } from 'components/curate/item-submission-panel'
import { HeroFacts } from 'components/curate/item-hero-facts'
import {
  HERO_PICTURE_MARK,
  ImagePlate,
  heroPicture,
  useHeroPictureSide,
} from 'components/curate/item-media-band'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import { DisputeCasePanel } from 'components/curate/dispute-case-panel'
import {
  DisputeRecordPanel,
  type DisputeRecord,
} from 'components/curate/dispute-record-panel'
import { PolicySince, policyInForceSince } from './policy-since'
import {
  formatTokenAmount,
  multiplierPercent,
  nativeText,
  tokenText,
} from './modals/shell'
import { entrySetting } from './arbitration-setting'
import {
  rulingShort,
  stakeCaseState,
  stakeCourtLink,
  stakeFacts,
  stakeStatusCode,
  toNum,
  type StakeItem,
  type StakeRegistry,
} from './facts'

/*
 * Stake Curate item page, one layout in three states (listed, in its
 * submission or withdrawal period, in court), on the Standard item
 * composition. A top line — where the entry sits, and at its right end the
 * policy it is judged by — then the hero (the one featured panel), in two
 * columns. On the left, one flow: the entry named large with its status,
 * the facts strip (when, by whom, the item ID), and straight under it the
 * entry's full details — every field it has (round 4: the details were a
 * second box below). On the right, the page's one clock — the submission
 * period, the withdrawal period, the appeal period, the court period, or
 * the date it settled — then the one thing to do now, with its amount and
 * its button, and then the entry's picture when it has exactly one and the
 * left column runs on beside it (otherwise the picture opens the full
 * details, so neither column ends far above the other). While a case is
 * live, one full-width panel holds it: where it stands, its periods, its
 * jury and its actions. Then the history, with a rail beside it for the
 * withdrawal stepper and the appeal funding while either has something to
 * show. At 1000px and below the fixed bottom bar carries the action. A
 * case the court has already decided is not live: it sits quietly at the
 * top of the history column as a record of what the jurors did, and an
 * entry challenged more than once keeps one record box with a tab per
 * case. Every figure comes from the subgraph, the list contract and the
 * clock.
 */

/* The page's top line: where the entry sits, and at its right end the
   policy it is judged by (round 3: the policy used to sit on the status
   line, in the middle of the hero). The entrance fires on this row, so the
   crumb and the pill arrive together. */
const TopRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  ${reveal}
`

const Crumbs = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    text-decoration: none;
    transition: color var(--motion);
  }

  a:hover {
    color: var(--color-text);
  }

  span[aria-current] {
    color: var(--color-text);
  }
`

/* Two independent columns (round 5 of the design review). The left is one
   flow: identity, facts strip, full details, each straight under the last.
   The right is the clock and the action under it. They share no rows, so
   however tall the clock and the action stand, they can no longer push
   empty space under the facts strip: in round 4 a grid row shared with the
   clock opened a 114px band there, and its hairlines drew a box round the
   clock. The right column draws no line of its own.

   The entry's one picture goes where it leaves the least empty glass
   (useHeroPictureSide): under the action beside a long field list, or
   first in the full details beside a tall action card. Fixed under the
   clock, it left a block of empty glass about 870px wide and 284px tall at
   the bottom-left of a decided entry with two fields.

   The action sits under the clock so the thing to do, with its amount, is
   on the first screen at 1440x900 in every state (round 4's full details
   had pushed the card in the rail below the fold). The right column scrolls
   with the hero (round 7); past it, the bottom bar carries the action.

   At 1000px and below both columns dissolve (display: contents) and one
   order sets the sequence: identity, clock, facts, picture, full details,
   then the action, so the time pressure is near the top and the picture
   leads the details it belongs to. The fixed bottom bar carries the action
   there until the hero's own copy of it scrolls into view. */
const Hero = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  margin-top: 20px;
  ${reveal}

  @media (max-width: 1000px) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
`

const HeroLeft = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  @media (max-width: 1000px) {
    display: contents;
  }
`

/* Its 32px top padding is HeroMain's, so the clock's label lines up with
   the eyebrow. 24px at the sides leaves the action its 312px measure, the
   width it had as a card in the rail. It scrolls with the hero (round 7:
   the sticky column read as floating); once the action is off screen the
   bottom bar carries it (item-standard-action-bar.tsx). */
const HeroAside = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
  padding: 32px 24px 28px;

  @media (max-width: 1000px) {
    display: contents;
  }
`

const HeroMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 32px 36px 20px;

  @media (max-width: 1000px) {
    order: 1;
  }

  @media (max-width: 720px) {
    padding: 22px 18px 18px;
  }
`

const HeroStats = styled.div`
  min-width: 0;
  padding: 0 36px 20px;

  @media (max-width: 1000px) {
    order: 3;
    padding-top: 4px;
  }

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

const HeroSide = styled.div`
  min-width: 0;

  @media (max-width: 1000px) {
    order: 2;
    padding: 4px 36px 24px;
  }

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

/* The entry's one picture, under the clock and the action, when it leaves
   less empty glass here than first in the full details. Stacked, its order
   puts it between the facts and the full details wherever the wide layout
   placed it. */
const HeroPicture = styled.div`
  min-width: 0;

  @media (max-width: 1000px) {
    order: 4;
    padding: 0 36px 24px;
  }

  @media (max-width: 720px) {
    padding: 0 18px 20px;
  }
`

/* The entry's own fields, every one of them, straight under the facts
   strip. It draws its own inset hairline the way the facts strip does —
   not a panel, so nothing is stacked inside the one featured box. */
const HeroFields = styled.div`
  min-width: 0;
  padding: 0 36px 28px;

  @media (max-width: 1000px) {
    order: 5;
  }

  @media (max-width: 720px) {
    padding: 0 18px 22px;
  }
`

/* Where the action card renders itself (ItemStatusCard portals into it),
   bare, as part of the hero rather than a panel inside it. Empty while
   there is nothing to do (in court, the case panel holds the actions), and
   then it takes no room. Stacked, it closes the hero under an inset
   hairline, after the full details. */
const HeroAction = styled.div`
  min-width: 0;

  &:empty {
    display: none;
  }

  @media (max-width: 1000px) {
    order: 6;
    margin: 0 36px 28px;
    padding-top: 24px;
    border-top: 1px solid var(--glass-border);
  }

  @media (max-width: 720px) {
    margin: 0 18px 22px;
    padding-top: 20px;
  }
`

const Eyebrow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
`

const Title = styled.h1<{ $size: 'lg' | 'md' | 'sm' }>`
  margin: 0;
  min-width: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: ${({ $size }) =>
    $size === 'lg'
      ? 'clamp(30px, 1.6vw + 18px, 40px)'
      : $size === 'md'
        ? 'clamp(24px, 1vw + 16px, 32px)'
        : 'clamp(20px, 0.6vw + 14px, 26px)'};
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
  text-wrap: balance;

  a {
    color: inherit;
  }
`

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
`

/* Full width under the hero: a live case is one region of the page, never
   a card in the rail. */
const CaseRegion = styled.div`
  margin-top: 24px;
  ${reveal}
`

/* The history across the page, with a right-hand rail only while it holds
   something: the withdrawal stepper while the entry is listed (or once it
   is withdrawn) and the appeal funding while an appeal is open. The action
   card is in the hero now, so a rail kept in every state would stand empty
   beside the history for an entry off the list. A flex row, so an empty
   rail (:empty, display none) takes no room and the history widens. */
const Columns = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 24px;

  @media (max-width: 1000px) {
    flex-direction: column;
    align-items: stretch;
  }
`

const Main = styled.div`
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 24px;
  min-width: 0;

  > * {
    ${reveal}
  }

  > :nth-child(1) {
    --i: 3;
  }

  > :nth-child(2) {
    --i: 4;
  }

  > :nth-child(3) {
    --i: 5;
  }

  > :nth-child(4) {
    --i: 6;
  }
`

/* The court record, as the history column's first box. It stretches to
   the height useLevelRow asks of it (--level-record), so its foot meets the
   rail panel's beside it. */
const RecordSlot = styled.div`
  display: flex;
  flex-direction: column;
  min-height: var(--level-record, 0);

  > * {
    flex: 1 0 auto;
  }
`

/* Beside the history; it scrolls with the page (round 7: nothing on the
   right of an entry floats). Its first panel stretches to the height
   useLevelRow asks of it (--level-rail). */
const Rail = styled.aside`
  align-self: flex-start;
  display: flex;
  flex: 0 0 360px;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  &:empty {
    display: none;
  }

  > * {
    ${reveal}
    --i: 2;
  }

  > :first-child {
    min-height: var(--level-rail, 0);
  }

  @media (max-width: 1000px) {
    position: static;
    flex: none;
    order: -1;
  }
`

/* Above this width the rail sits beside the history; below, it stacks. */
const ROW_STACKED = '(max-width: 1000px)'

/* How far apart the two boxes' resting heights may be and still be made
   to end level. Further apart, one of them is open (the jury under the
   record) or simply holds more, and stretching the other would leave it
   half empty. */
const LEVEL_MAX = 64

/**
 * The court record and the rail's first panel (the withdrawal, or the
 * appeal funding) open the row under the hero side by side, from the same
 * top. Their heights come from different content, so they ended a few
 * pixels apart (the audit measured 206 against 216). This stretches the
 * shorter of the two to the taller's resting height when the two nearly
 * match, and leaves both alone when they are far apart or stacked. Each is
 * measured at its own height, with the stretch taken off first, so the
 * answer never feeds on itself.
 */
const useLevelRow = (
  row: HTMLElement | null,
  record: HTMLElement | null,
  rail: HTMLElement | null,
) => {
  useEffect(() => {
    if (
      !row ||
      !record ||
      !rail ||
      typeof ResizeObserver === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return undefined
    const stacked = window.matchMedia(ROW_STACKED)
    const clear = () => {
      row.style.removeProperty('--level-record')
      row.style.removeProperty('--level-rail')
    }
    const measure = () => {
      clear()
      const panel = rail.firstElementChild as HTMLElement | null
      if (stacked.matches || !panel) return
      const recordHeight = record.offsetHeight
      const panelHeight = panel.offsetHeight
      const apart = Math.abs(recordHeight - panelHeight)
      if (apart === 0 || apart > LEVEL_MAX) return
      if (recordHeight < panelHeight)
        row.style.setProperty('--level-record', `${panelHeight}px`)
      else row.style.setProperty('--level-rail', `${recordHeight}px`)
    }
    // Either box changes height as its content arrives or opens, and the
    // rail's first panel can change (the appeal funding comes and goes).
    const observer = new ResizeObserver(measure)
    observer.observe(record)
    observer.observe(rail)
    stacked.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      stacked.removeEventListener('change', measure)
      clear()
    }
  }, [row, record, rail])
}

const PolicyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--motion),
    border-color var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }
`

/** How long the list's MetaEvidence file may take before its read fails. */
const META_EVIDENCE_TIMEOUT_MS = 20_000

/** The size the title is set at, so long identifiers stay readable. */
const titleSize = (text: string): 'lg' | 'md' | 'sm' =>
  text.length > 90 ? 'sm' : text.length > 44 ? 'md' : 'lg'

interface ItemDetailsProps {
  itemID: string
  search?: string
}

const ItemDetails = ({ itemID, search }: ItemDetailsProps) => {
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const library = useEthersProvider({
    chainId: chainId ?? undefined,
  })
  const [ipfsItemData, setIpfsItemData] = useState<ItemFile | undefined>()
  const [ipfsError, setIpfsError] = useState(false)
  const timestamp = useContext(WalletContext)?.timestamp
  // The two places the status card draws itself: its action under the
  // hero's clock, its withdrawal and appeal funding in the rail.
  const [actionSlot, setActionSlot] = useState<HTMLDivElement | null>(null)
  const [railSlot, setRailSlot] = useState<HTMLElement | null>(null)
  const railSlotRef = useCallback((element: HTMLElement | null) => {
    setRailSlot(element)
  }, [])
  const [modalOpen, setModalOpen] = useState(false)
  const { graphqlBatcher } = useGraphqlBatcher()
  const now = useNow()
  const openAttachment = useAttachment()
  const nativeCurrency = useNativeCurrency()

  // Opened right after submitting it (submit-item): a missing entry is
  // still being indexed, not absent.
  const location = useLocation()
  const recentlySubmitted = justSubmitted(location.state)
  // Subgraph item entities have id "<itemID>@<listaddress>".
  const compoundId = `${itemID}@${tcrAddress?.toLowerCase()}`
  const query = useQuery({
    queryKey: ['permanentItemDetails', compoundId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_ITEM_DETAILS_QUERY,
        variables: { id: compoundId },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId,
    staleTime: STALE_TIME,
    // An entry sent a moment ago can take a while to reach the subgraph:
    // keep looking for a while before settling on "not found".
    refetchInterval: (query) =>
      query.state.status === 'success' && !query.state.data?.item
        ? missingEntryPollMs(query.state.dataUpdateCount, recentlySubmitted)
        : false,
  })

  // Every settings change of the list, for the date of the policy in force.
  // The list page reads the same query, so it is cached when coming from it.
  const settingsQuery = useQuery({
    queryKey: ['permanentRegistry', tcrAddress, chainId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_REGISTRY_QUERY,
        variables: { lowerCaseTCRAddress: tcrAddress?.toLowerCase() },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId && !!tcrAddress,
    staleTime: STALE_TIME,
  })
  const listSettings = settingsQuery.data?.registry?.arbitrationSettings as
    | SubgraphArbitrationSetting[]
    | undefined

  const item = useMemo(
    () =>
      (query.isLoading ? undefined : query.data?.item) as StakeItem | undefined,
    [query.isLoading, query.data],
  )

  const registry = useMemo(
    () =>
      (query.isLoading ? undefined : query.data?.item?.registry) as
        | StakeRegistry
        | undefined,
    [query.isLoading, query.data],
  )

  useEffect(() => {
    if (!item || ipfsItemData || ipfsError) return
    fetch(parseIpfs(item.data))
      .then((r) => r.json())
      .then((r) => {
        const file = sanitizeItemFile(r)
        if (!file) throw new Error('The entry file is not an entry')
        return setIpfsItemData(file)
      })
      .catch((err: unknown) => {
        console.error('Could not get ipfs file', err)
        setIpfsError(true)
      })
  }, [item, ipfsItemData, ipfsError])

  // A new submission takes the newest arbitration setting. A challenge, and
  // the policy the entry is judged by, take the one the contract picks for
  // this entry (arbitration-setting.ts): for a while after the governor
  // changes the settings, that is still the previous one.
  const latestSetting = registry?.arbitrationSettings?.[0]
  const chainNow = timestamp?.toNumber()
  const setting = useMemo(() => {
    if (!item || !registry || chainNow === undefined) return undefined
    return entrySetting(listSettings, {
      status: item.status,
      includedAt: toNum(item.includedAt),
      withdrawingAt: toNum(item.withdrawingTimestamp),
      challengedAt: toNum(item.challenges?.[0]?.createdAt),
      cooldown: toNum(registry.arbitrationParamsCooldown),
      now: chainNow,
    })
  }, [item, registry, listSettings, chainNow])
  const settingInForce = setting ?? latestSetting

  const arbitrationCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData: latestSetting?.arbitratorExtraData,
    library,
  })
  // Until the list's settings load, which one a challenge uses is unknown,
  // so no challenge cost is offered yet.
  const challengeCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData: settingsQuery.isLoading
      ? undefined
      : settingInForce?.arbitratorExtraData,
    library,
  })

  // The submitter as the contract records it (msg.sender). The subgraph
  // records the transaction's sender, another address when a contract wallet
  // such as a Safe submitted, and only the contract's record can start a
  // withdrawal. The subgraph's value stands in while this loads.
  const submitterQuery = useQuery({
    queryKey: [
      'permanentItemSubmitter',
      chainId,
      registry?.id,
      item?.itemID,
      item?.includedAt,
    ],
    queryFn: async () => {
      const list = new ethers.Contract(registry!.id, _gtcr, library!)
      const record = await list.items(item!.itemID)
      return String(record.submitter).toLowerCase()
    },
    enabled: !!registry?.id && !!library && !!item?.itemID,
    staleTime: STALE_TIME,
  })
  const submitter = submitterQuery.data ?? item?.submitter

  // What the next appeal costs, for the appeal funding card and dialog. It
  // is read again for each new challenge or round, and a failed read is
  // retried, so the dialog never waits on a stale or missing figure.
  const latestChallenge = item?.challenges?.[0]
  const appealCostQuery = useQuery({
    queryKey: [
      'permanentAppealCost',
      chainId,
      registry?.arbitrator?.id,
      latestChallenge?.disputeID,
      latestChallenge?.rounds?.length,
    ],
    queryFn: async (): Promise<BigNumber> => {
      const arbitrator = new ethers.Contract(
        registry!.arbitrator.id,
        _IArbitrator,
        library!,
      )
      return arbitrator.appealCost(
        latestChallenge!.disputeID,
        latestChallenge!.arbitrationSetting.arbitratorExtraData,
      )
    },
    enabled:
      !!registry &&
      !!library &&
      !!latestChallenge &&
      !latestChallenge.disputeOutcome,
    staleTime: STALE_TIME,
  })
  const appealCostFailed =
    appealCostQuery.isError && !appealCostQuery.isFetching

  // The list's MetaEvidence: its title, item name and field names. Whoever
  // governs the list writes it, so it gets the shape the page reads before
  // anything renders it (a title that is an object took the page down). A
  // gateway that errors or hangs, or a file that is not a MetaEvidence with
  // its metadata, is a failed read: retried, then said, with Try again,
  // rather than left loading for ever.
  const metaEvidenceURI = latestSetting?.metaEvidenceURI
  const metaEvidenceQuery = useQuery({
    queryKey: ['permanentMetaEvidence', metaEvidenceURI],
    queryFn: async (): Promise<MetaEvidence> => {
      const controller = new AbortController()
      // Not AbortSignal.timeout: iOS 15 lacks it.
      const timer = setTimeout(
        () => controller.abort(),
        META_EVIDENCE_TIMEOUT_MS,
      )
      try {
        const response = await fetch(parseIpfs(metaEvidenceURI!), {
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error(`The list metadata answered ${response.status}`)
        const file = sanitizeMetaEvidence(await response.json())
        if (!file?.metadata)
          throw new Error('The list metadata is not a MetaEvidence file')
        return file
      } finally {
        clearTimeout(timer)
      }
    },
    enabled: !!metaEvidenceURI,
    staleTime: Infinity,
  })
  const metaEvidence = metaEvidenceQuery.data
  const metaEvidenceFailed = metaEvidenceQuery.isError && !metaEvidence

  const decodedItem = useMemo(() => {
    if (!item || !metaEvidence?.metadata?.columns || !ipfsItemData)
      return undefined

    const orderDecodedData = (columns: Column[], values: ItemFile['values']) =>
      columns.map((column) => values[column.label] ?? null)

    return {
      ...item, // Spread to convert from array to object.
      errors: [] as string[],
      columns: metaEvidence.metadata.columns,
      decodedData: orderDecodedData(
        metaEvidence.metadata.columns,
        ipfsItemData.values,
      ),
    }
  }, [item, metaEvidence, ipfsItemData])

  const { metadata } = metaEvidence || {}
  const { decodedData, columns } = decodedItem || {}
  const { tcrTitle, itemName } = metadata || {}
  const { symbol: tokenSymbol, decimals: tokenDecimals } = useTokenSymbol(
    registry?.token,
  )

  const statusCode = useMemo(() => {
    if (!item || !timestamp || !registry) return null
    return stakeStatusCode(item, timestamp, registry) ?? null
  }, [item, timestamp, registry])

  const entryStatus = useMemo(
    () => stakeEntryStatus(item, timestamp, registry),
    [item, timestamp, registry],
  )

  const fields = useMemo<EntryField[]>(
    () =>
      columns
        ? columns.map((column, index) => ({
            ...column,
            value: decodedData?.[index],
          }))
        : [],
    [columns, decodedData],
  )
  const primaryField = useMemo(() => titleField(fields), [fields])
  // The entry's one picture; none when it has none, or several (those stay
  // in the full details' band). It goes where it leaves the least empty
  // glass in the hero: under the clock, or first in the full details.
  const picture = useMemo(() => heroPicture(fields), [fields])
  const [heroLeft, setHeroLeft] = useState<HTMLDivElement | null>(null)
  const [heroAside, setHeroAside] = useState<HTMLDivElement | null>(null)
  const pictureSide = useHeroPictureSide(heroLeft, heroAside, !!picture)
  // The row under the hero, and the court record that opens it, so the
  // record and the rail's first panel can end level (useLevelRow).
  const [historyRow, setHistoryRow] = useState<HTMLDivElement | null>(null)
  const [recordSlot, setRecordSlot] = useState<HTMLDivElement | null>(null)
  useLevelRow(historyRow, recordSlot, railSlot)

  // The tab names the entry itself (its heading), then its list.
  const seoName =
    primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : capitalizeFirstLetter(itemName ?? '') || 'Entry'
  const fullSeoTitle =
    decodedItem && metadata
      ? `${seoName} · ${tcrTitle} | Kleros Curate`
      : 'Kleros Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 160)

  // The status as the page labels it, as on Standard entries. Accepted only
  // means nobody challenged it in time, and it stays challengeable: the
  // description claims no verification.
  const fullSeoMetaDescription =
    decodedItem && metadata && entryStatus && decodedData
      ? `${decodedData.join(' ')} · ${entryStatus.label} on ${
          metadata.tcrTitle
        } in Kleros Curate`
      : 'View item details on Kleros Curate.'
  const truncatedSeoMetaDescription = truncateAtWord(
    fullSeoMetaDescription,
    160,
  )

  const loading =
    !metadata ||
    (!decodedData && decodedItem && decodedItem.errors.length === 0)
  // The subgraph item is here but its fields cannot be decoded: the IPFS
  // file failed to load, or the list's metadata declares no columns.
  const fieldsUnavailable = Boolean(
    item && metadata && !decodedItem && (ipfsError || !metadata.columns),
  )

  // Check if there is some action on the URL and, if so, run it.
  useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(search)
    if (!params.get('action')) return

    setModalOpen(true)
  }, [loading, search])

  const loadFailed = query.isError && !query.data
  const missing = query.isSuccess && !query.data?.item
  // An error page sets its own title, and keeps a missing entry out of
  // search results: this page's head would overwrite both (its effects run
  // after the error page's), so it waits for an entry to describe.
  const errorPage = !tcrAddress || !itemID || loadFailed || missing
  useDocumentHead(
    errorPage ? undefined : truncatedSeoTitle,
    errorPage ? undefined : truncatedSeoMetaDescription,
  )
  const registryHref = `/tcr/${chainId}/${tcrAddress}`

  if (!tcrAddress || !itemID)
    return (
      <ErrorPage
        code="400"
        message="This entry could not be found."
        tip={ENTRY_LINK_TIP}
      />
    )

  // A failed read and a missing entry each get their own page; neither is
  // left as a loading skeleton. Each leads back to the list.
  if (loadFailed)
    return (
      <ErrorPage
        code="Error"
        title="This entry did not load"
        message={ENTRY_LOAD_FAILED}
        onRetry={() => query.refetch()}
        home={{ to: registryHref, label: 'Back to the list' }}
      />
    )

  if (missing && recentlySubmitted)
    return (
      <ErrorPage
        code="Indexing"
        tone="window"
        title={ENTRY_INDEXING_TITLE}
        message={ENTRY_INDEXING_MESSAGE}
        home={{ to: registryHref, label: 'Back to the list' }}
      />
    )

  if (missing)
    return (
      <ErrorPage
        code="404"
        title="Entry not found"
        message="This list has no entry with this ID."
        tip={ENTRY_MISSING_TIP}
        home={{ to: registryHref, label: 'Back to the list' }}
      />
    )

  const name = itemName || 'item'
  const Name = capitalizeFirstLetter(name)
  // Without the list's file there are no fields to title the entry with:
  // the list's item name as the subgraph keeps it stands in, else "Entry".
  const heading = metaEvidenceFailed
    ? capitalizeFirstLetter(latestSetting?.metadata?.itemName ?? '') || 'Entry'
    : Name
  const policyURI =
    settingInForce?.metadata?.policyURI ?? latestSetting?.metadata?.policyURI
  // When that policy took effect: settings newer than the one in force for
  // this entry do not apply to it yet.
  const policySince = policyInForceSince(
    setting && listSettings
      ? listSettings.filter(
          (other) => toNum(other.timestamp) <= toNum(setting.timestamp),
        )
      : listSettings,
  )
  const titleText =
    primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : heading

  const facts =
    item && registry && statusCode !== null
      ? stakeFacts({ item, registry, statusCode, chainId })
      : undefined
  const challenge = facts?.challenge
  const challengeInSubmission =
    !!facts &&
    !!challenge?.challenger &&
    facts.hasDispute &&
    toNum(challenge.createdAt) >= facts.submissionStart
  // Where the case stands in the page's own words, for the case panel: the
  // court names the period, the page knows what it means for this entry.
  const caseWords =
    facts && statusCode !== null
      ? stakeCaseState(facts, statusCode, now)
      : undefined
  // The contract takes evidence on any entry that is not Absent, as the
  // history's composer does.
  const canAddEvidence = !!item && item.status !== CONTRACT_STATUS.ABSENT
  /*
   * The cases the court has already decided, newest first as the history
   * numbers them. An entry here can be challenged again and again, so
   * several are literally possible. An appeal being funded is not over —
   * money is being raised and the rail's funding card is live — so only a
   * challenge whose ruling already stands, or one long settled, is a
   * record.
   *
   * Every challenge is a case, so there is no case number to test: the
   * arbitrator numbers its first dispute 0, and that case is as real as
   * any other.
   */
  const decidedDisputes: DisputeRecord[] = (item?.challenges ?? [])
    .filter(
      (past, index) =>
        toNum(past.resolutionTime) > 0 ||
        (index === 0 && caseWords?.awaitingCourt === false),
    )
    .map((past) => {
      const court = stakeCourtLink(
        chainId,
        registry?.arbitrator?.id,
        past.disputeID,
      )
      const round = past.rounds?.[0]
      const settled = toNum(past.resolutionTime) > 0
      return {
        disputeID: String(past.disputeID),
        arbitrator: registry?.arbitrator?.id,
        requesterName: 'submitter',
        // Once settled the outcome can differ from the jurors' last
        // ruling: a side that alone funded the last appeal wins. Until
        // then the challenge still records 'None', which would read as
        // "Refused to rule", so the ruling is the jurors' own and only
        // once the court has given one — as stakeCaseState reads it, so
        // the hero and the record never disagree about the same case.
        ruling: settled
          ? rulingShort(past.disputeOutcome ?? round?.ruling)
          : toNum(round?.rulingTime) > 0
            ? rulingShort(round?.ruling)
            : undefined,
        href: court?.href,
        host: court?.host,
      }
    })

  // Why the fields cannot be read, said in the full-details panel itself:
  // one region holds the entry's fields, whether or not they came through.
  const submissionErrors = metaEvidenceFailed
    ? ["The list's field names could not be loaded from IPFS."]
    : fieldsUnavailable
      ? [
          ipfsError
            ? `The ${name}'s data could not be loaded from IPFS.`
            : `This list's metadata declares no fields, so the ${name} cannot be displayed.`,
        ]
      : (decodedItem?.errors ?? [])

  const minStake = registry?.submissionMinDeposit
  // An arbitration cost that shows as nothing (none, or a few gwei below
  // the precision shown) is not named as a cost: "plus 0 xDAI for
  // arbitration" read as a fee that is not there.
  const showsAsNothing = (amount: BigNumber) =>
    formatTokenAmount(amount.toString(), 18, 5) === '0'
  const submitCost = arbitrationCost.arbitrationCost
  const challengeFree =
    !!challengeCost.arbitrationCost &&
    showsAsNothing(challengeCost.arbitrationCost)
  // Only Kleros has jurors to name.
  const klerosDecides = isKlerosArbitrator(chainId, registry?.arbitrator?.id)
  const explainerSteps = [
    {
      title: 'A stake backs every entry',
      body: registry
        ? `At least ${tokenText(minStake ?? 0, tokenDecimals, tokenSymbol)} in the list's token${
            !submitCost
              ? ' plus an arbitration deposit'
              : showsAsNothing(submitCost)
                ? ''
                : ` plus ${nativeText(submitCost, nativeCurrency)} for arbitration`
          }. It backs the ${name} while listed and comes back when the submitter withdraws.`
        : `A token stake and an arbitration deposit back the ${name} while listed, and come back when the submitter withdraws.`,
    },
    {
      title: 'Spot a mistake, earn the stake',
      body: registry
        ? `Challenge a ${name} that breaks the policy, at any time, with ${multiplierPercent(registry.challengeStakeMultiplier)} of its stake${
            challengeFree ? '' : ' plus the arbitration cost'
          }. If ${klerosDecides ? 'jurors agree' : 'the arbitrator agrees'}, you take its stake and arbitration deposit and your stake comes back; if not, your stake is added to the ${name}'s. ${
            toNum(registry.submissionPeriod) > 0
              ? `Pending for ${formatDurationLong(toNum(registry.submissionPeriod))}, then accepted.`
              : `Accepted at once: this list has no submission period.`
          }`
        : `Challenge a ${name} that breaks the policy, at any time, with a share of its stake. If ${klerosDecides ? 'jurors agree' : 'the arbitrator agrees'}, you take its stake and your stake comes back; if not, your stake is added to the ${name}'s.`,
    },
    {
      title: 'Withdraw to get the stake back',
      body: registry
        ? `The submitter starts a withdrawal${
            toNum(registry.withdrawingPeriod) > 0
              ? `, waits ${formatDurationLong(toNum(registry.withdrawingPeriod))}`
              : ''
          }, then anyone executes it. Still challengeable while withdrawing.`
        : `The submitter starts a withdrawal, waits the withdrawing period, then anyone executes it.`,
    },
  ]

  return (
    <Page>
      <TopRow>
        <Crumbs aria-label="Breadcrumb">
          <Link to={registryHref}>
            <CurateIcon name="registry" size={14} />
            {tcrTitle || 'List'}
          </Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{Name}</span>
        </Crumbs>
        {/* Outside the breadcrumb: the policy is what the entry is judged
            by, not a place on the way to it. */}
        {policyURI && (
          <PolicyButton
            type="button"
            onClick={() => openAttachment(parseIpfs(policyURI), true)}
          >
            <CurateIcon name="policy" size={14} />
            Listing policy
            <PolicySince
              since={policySince}
              loading={settingsQuery.isLoading}
              now={now}
            />
          </PolicyButton>
        )}
      </TopRow>

      <Hero
        as="section"
        // The floating action bar waits for the reader to reach its end.
        data-entry-hero
        $featured
        $padding="none"
        aria-label={`${Name} overview`}
        style={{ ['--i' as string]: 1 }}
      >
        <HeroLeft ref={setHeroLeft}>
          <HeroMain>
            <Eyebrow>
              <Label $tone="faint">
                {metadata ? Name : 'Stake Curate entry'}
              </Label>
              {chainId && <ChainChip chainId={chainId} size="sm" />}
            </Eyebrow>
            {loading && !fieldsUnavailable && !metaEvidenceFailed ? (
              <SkeletonBlock $height="40px" $width="min(420px, 100%)" />
            ) : (
              <Title $size={titleSize(titleText)}>
                {primaryField ? (
                  <FieldValue field={primaryField} detailed />
                ) : (
                  heading
                )}
              </Title>
            )}
            <StatusRow>
              {entryStatus ? (
                // The ring beside it already draws whatever window is
                // running, so the chip keeps its dot, its label and the
                // countdown, and leaves the track to the ring.
                <EntryStatus
                  status={{ ...entryStatus, windowStart: undefined }}
                  now={now}
                />
              ) : (
                <SkeletonBlock $height="18px" $width="220px" />
              )}
            </StatusRow>
          </HeroMain>
          <HeroStats>
            {item && facts ? (
              <HeroFacts
                when={{
                  label: facts.reincluded ? 'Reincluded' : 'Submitted',
                  at: facts.includedAt,
                }}
                bounty={
                  // While a case is live, what it is over: the entry's
                  // stake, which a challenger the jurors agree with takes
                  // (DESIGN.md's bounty). The action card that leads with it
                  // is not drawn in court.
                  facts.underDispute && tokenSymbol
                    ? {
                        figure: formatTokenAmount(item.stake, tokenDecimals),
                        symbol: tokenSymbol,
                        // Only Kleros has jurors to name.
                        title: `${tokenText(item.stake, tokenDecimals, tokenSymbol)}: what the challenger takes if ${
                          isKlerosArbitrator(chainId, registry?.arbitrator?.id)
                            ? 'jurors agree'
                            : 'the arbitrator agrees'
                        } with them, on top of their own stake back`,
                      }
                    : undefined
                }
                by={submitter}
                challengedBy={
                  challengeInSubmission ? challenge?.challenger : undefined
                }
                itemID={item.itemID}
                now={now}
              />
            ) : (
              <SkeletonBlock $height="44px" />
            )}
          </HeroStats>
          <HeroFields>
            <ItemSubmissionPanel
              fields={fields}
              item={decodedItem ?? item}
              errors={submissionErrors}
              loading={
                Boolean(loading) && !fieldsUnavailable && !metaEvidenceFailed
              }
              retry={
                metaEvidenceFailed ? (
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    disabled={metaEvidenceQuery.isFetching}
                    onClick={() => void metaEvidenceQuery.refetch()}
                  >
                    {metaEvidenceQuery.isFetching ? 'Loading…' : 'Try again'}
                  </Button>
                ) : undefined
              }
              kind="stake"
              leadsWithPicture={pictureSide === 'details'}
            />
          </HeroFields>
        </HeroLeft>
        <HeroAside ref={setHeroAside}>
          <HeroSide>
            {item && facts && statusCode !== null ? (
              <StakeWindowPanel
                facts={facts}
                statusCode={statusCode}
                arbitrator={registry?.arbitrator?.id}
                now={now}
              />
            ) : (
              <SkeletonBlock
                $height="216px"
                $width="216px"
                style={{ margin: '0 auto', borderRadius: '50%' }}
              />
            )}
          </HeroSide>
          <HeroAction ref={setActionSlot} />
          {picture && pictureSide === 'aside' && (
            <HeroPicture {...HERO_PICTURE_MARK}>
              <ImagePlate image={picture} layout="rail" />
            </HeroPicture>
          )}
        </HeroAside>
      </Hero>

      {/* One region for a live case: where it stands, its periods, its jury
          and its actions (the design review's point 6.2). Only while the
          court is still deciding or an appeal is being funded — once the
          ruling stands, the record box below says so instead. */}
      {facts?.hasDispute &&
        facts.underDispute &&
        (caseWords?.awaitingCourt ?? true) && (
          <CaseRegion style={{ ['--i' as string]: 2 }}>
            <DisputeCasePanel
              chainId={chainId}
              arbitrator={registry?.arbitrator?.id}
              arbitrable={tcrAddress}
              disputeID={facts.disputeID}
              disputeHref={facts.courtHref}
              disputeHost={facts.courtHost}
              requesterName="submitter"
              heading={caseWords?.heading ?? 'In court'}
              awaitingCourt={caseWords?.awaitingCourt ?? true}
              summary={caseWords?.summary}
              ruling={caseWords?.ruling}
              rulingLabel={caseWords?.rulingLabel}
              canAddEvidence={canAddEvidence}
              holdsPageActions={!!facts.inCourt}
              now={now}
            />
          </CaseRegion>
        )}

      <Columns ref={setHistoryRow}>
        <Main>
          {/* The record of what the court decided, collapsed: no clock, no
              period spine. It keeps the entry's actions, since the status
              card is not rendered while the entry waits on the court. Its
              foot meets the rail panel's beside it (useLevelRow). */}
          {decidedDisputes.length > 0 && (
            <RecordSlot ref={setRecordSlot}>
              <DisputeRecordPanel
                chainId={chainId}
                arbitrable={tcrAddress}
                disputes={decidedDisputes}
                canAddEvidence={canAddEvidence}
                holdsPageActions={
                  !!facts?.inCourt && caseWords?.awaitingCourt === false
                }
              />
            </RecordSlot>
          )}
          {/* Seer markets: what the entry's own fields cannot say, read
              from the market's own contract. A bordered box of its own, so
              it stands in this column rather than inside the hero. */}
          {tcrAddress !== undefined &&
            chainId !== null &&
            isSeerRegistry(tcrAddress, chainId) &&
            typeof decodedData?.[0] === 'string' &&
            typeof decodedData?.[1] === 'string' && (
              <SeerExtraDetails
                chainId={chainId}
                contractAddress={decodedData[0]}
                imagesIpfsHash={decodedData[1]}
              />
            )}
          <RequestTimelines item={item} metaEvidence={metaEvidence} />
          <Explainer
            id="stake-curate-item"
            eyebrow="How this list works"
            heading="A stake backs every entry. Spot a bad one and it is yours."
            steps={explainerSteps}
          />
        </Main>

        {/* The status card draws the withdrawal and the appeal funding in
            here; with neither, the rail takes no room. */}
        <Rail ref={railSlotRef} aria-label="Withdrawal and appeal funding" />
      </Columns>
      {/* The status card draws its action in the hero, under the clock, and
          its other panels in the rail (portals into both); mounted here it
          keeps the phone bar and the dialogs out of either layout. */}
      <ItemStatusCard
        item={decodedItem ?? item}
        registry={registry}
        timestamp={timestamp}
        modalOpen={modalOpen}
        metaEvidence={metaEvidence}
        setModalOpen={setModalOpen}
        appealCost={appealCostQuery.data}
        appealCostFailed={appealCostFailed}
        onRetryAppealCost={() => void appealCostQuery.refetch()}
        arbitrationCost={arbitrationCost.arbitrationCost}
        challengeArbitrationCost={challengeCost.arbitrationCost}
        submitter={submitter}
        policyURI={policyURI}
        heroSlot={actionSlot}
        railSlot={railSlot}
      />
      <StickyActionBarSpacer aria-hidden />
    </Page>
  )
}

export default ItemDetails
