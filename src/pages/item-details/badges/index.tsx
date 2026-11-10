import React, {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import { ethers, BigNumber } from 'ethers'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { gtcrDecode, gtcrEncode } from '@kleros/gtcr-encoder'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useGetLogs from 'hooks/get-logs'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import { WalletContext } from 'contexts/wallet-context'
import ItemStatusBadge from 'components/item-status-badge'
import { ZERO_ADDRESS, ZERO_BYTES32 } from 'utils/string'
import { STATUS_CODE } from 'utils/item-status'
import { gtcrViewAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  Chip,
  SkeletonBlock,
  Small,
  Surface,
} from 'components/curate/primitives'
import { Notice } from 'components/curate/item-light-notice'
import { reveal } from 'components/curate/motion/reveal'
import AddBadgeModal, { type BadgeInfo } from '../modals/add-badge'
import SubmitModal from '../modals/submit'
import SubmitConnectModal from '../modals/submit-connect'

/*
 * Badges: the other lists this Classic entry is also on. The parent list's
 * connected list holds one entry per badge list (its address and a match
 * file of the columns compared); each badge list is searched on chain for
 * this entry's matched values. Found badges are rows linking to the entry
 * on the badge list with its status there; "Add a badge" submits the entry
 * to a connected badge list, or connects a new one.
 */

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
`

const PanelName = styled.h2`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
`

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const BadgeRow = styled(Link)`
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-height: 64px;
  padding: 10px 14px 10px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion),
    transform var(--motion);
  ${reveal}

  &:hover {
    border-color: var(--color-border-strong);
    transform: translateY(-1px);
  }

  &:hover > svg {
    color: var(--color-text);
    transform: translateX(2px);
  }

  > svg {
    color: var(--color-faint);
    transition:
      color var(--motion),
      transform var(--motion);
  }

  @media (max-width: 560px) {
    grid-template-columns: 44px minmax(0, 1fr);

    > svg {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover,
    &:hover > svg {
      transform: none;
    }
  }
`

const Logo = styled.img`
  width: 44px;
  height: 44px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--color-surface);
  object-fit: contain;
`

const LogoFallback = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-faint);
`

const Identity = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    overflow: hidden;
    color: var(--color-text);
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const StatusSlot = styled.div`
  display: flex;
  min-width: 0;
`

const Empty = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  svg {
    flex: 0 0 auto;
    color: var(--color-faint);
  }
`

/** A row of GeneralizedTCRView.queryItems / findItem (numeric status). */
interface QueriedItem {
  ID: string
  data: string
  status?: number
  disputed?: boolean
  disputeStatus?: number
  submissionTime?: BigNumber
  [key: string]: unknown
}

interface FetchItemsState {
  fetchStarted?: boolean
  isFetching?: boolean
  data?: QueriedItem[] | null
  connectedTCRAddr?: string
}

interface FoundBadge {
  tcrAddress: string
  item: QueriedItem
  metadata: {
    logoURI?: string
    tcrTitle?: string
    tcrDescription?: string
    columns?: Column[]
    [key: string]: unknown
  }
  tcrData: { challengePeriodDuration?: BigNumber; [key: string]: unknown }
}

/** GeneralizedTCRView dispute status: 1 is "appealable". */
const DISPUTE_APPEALABLE = 1

/** The entry's status on the badge list, from the view contract's row. */
const badgeStatusCode = (
  found: QueriedItem,
  challengePeriodDuration: BigNumber | undefined,
  now: number,
): number | undefined => {
  const status = Number(found.status)
  if (status === 1) return STATUS_CODE.REGISTERED
  if (status !== 2 && status !== 3) return undefined
  const isSubmission = status === 2
  if (found.disputed)
    return Number(found.disputeStatus) === DISPUTE_APPEALABLE
      ? STATUS_CODE.CROWDFUNDING
      : STATUS_CODE.CHALLENGED
  const submitted = found.submissionTime
    ? BigNumber.from(found.submissionTime).toNumber()
    : 0
  if (
    challengePeriodDuration &&
    submitted > 0 &&
    now > submitted + challengePeriodDuration.toNumber()
  )
    return isSubmission
      ? STATUS_CODE.PENDING_SUBMISSION
      : STATUS_CODE.PENDING_REMOVAL
  return isSubmission ? STATUS_CODE.SUBMITTED : STATUS_CODE.REMOVAL_REQUESTED
}

interface BadgesProps {
  connectedTCRAddr?: string
  item?: SubgraphItem
  tcrAddress?: string
}

const Badges = ({ connectedTCRAddr, item, tcrAddress }: BadgesProps) => {
  const { timestamp } = useContext(WalletContext) ?? {}
  const chainId = useUrlChainId()
  const networkId = chainId ?? undefined
  const library = useEthersProvider({ chainId: networkId })
  // The connected list's columns (badge address, match file) decode its rows.
  const connectedMetaQuery = useTcrMetaEvidence(
    connectedTCRAddr && connectedTCRAddr !== ZERO_ADDRESS
      ? connectedTCRAddr
      : undefined,
    networkId,
  )
  const connectedColumns = connectedMetaQuery.data?.metadata?.columns

  const [error, setError] = useState<string | false>(false)
  const [addBadgeVisible, setAddBadgeVisible] = useState(false)
  const [submissionFormOpen, setSubmissionFormOpen] = useState(false)
  const [badgeToSubmit, setBadgeToSubmit] = useState<BadgeInfo>()
  const [foundBadges, setFoundBadges] = useState<FoundBadge[]>([])
  const [connectedBadges, setConnectedBadges] = useState<BadgeInfo[]>([])
  const [isFetchingBadges, setIsFetchingBadges] = useState(true)
  const [submitConnectVisible, setSubmitConnectVisible] = useState(false)
  const ARBITRABLE_TCR_VIEW_ADDRESS =
    networkId !== undefined ? gtcrViewAddresses[networkId] : undefined
  const [fetchItems, setFetchItems] = useState<FetchItemsState>({
    fetchStarted: true,
    isFetching: false,
    data: null,
  })
  const getLogs = useGetLogs(library ?? null)

  // Wire up the view contract and the connected list.
  const gtcrView = useMemo(() => {
    if (!library || !ARBITRABLE_TCR_VIEW_ADDRESS || !networkId) return
    try {
      return new ethers.Contract(
        ARBITRABLE_TCR_VIEW_ADDRESS,
        _GTCRView,
        library,
      )
    } catch (err) {
      console.error('Error instantiating gtcr view contract', err)
      setError('Error instantiating view contract')
    }
  }, [ARBITRABLE_TCR_VIEW_ADDRESS, library, networkId])

  const gtcr = useMemo(() => {
    if (!library || !connectedTCRAddr || !networkId) return
    try {
      return new ethers.Contract(connectedTCRAddr, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError('Error setting up this list')
    }
  }, [connectedTCRAddr, library, networkId])

  // The connected list's meta evidence could not be read: nothing to decode.
  useEffect(() => {
    if (!connectedMetaQuery.isFetched) return
    if (connectedMetaQuery.error || !connectedColumns) {
      setError('The connected badge list could not be read.')
      setIsFetchingBadges(false)
    }
  }, [connectedColumns, connectedMetaQuery.error, connectedMetaQuery.isFetched])

  // Fetch the enabled badges: registered rows of the connected list.
  useEffect(() => {
    if (
      !gtcr ||
      !gtcrView ||
      !connectedTCRAddr ||
      connectedTCRAddr === ZERO_ADDRESS ||
      fetchItems.isFetching ||
      !fetchItems.fetchStarted
    )
      return

    setFetchItems({ isFetching: true })
    setIsFetchingBadges(true)
    // Filter fields
    //  - Include absent items in result;
    //  - Include registered items in result;
    //  - Include items with registration requests that are not disputed in result;
    //  - Include items with clearing requests that are not disputed in result;
    //  - Include disputed items with registration requests in result;
    //  - Include disputed items with clearing requests in result;
    //  - Include items with a request by _party;
    //  - Include items challenged by _party.
    const filter = [false, true, false, true, false, false, false, false]
    const oldestFirst = false
    const itemsPerRequest = 100
    ;(async () => {
      try {
        const result = await gtcrView.queryItems(
          connectedTCRAddr,
          0,
          itemsPerRequest,
          filter,
          oldestFirst,
          ZERO_ADDRESS,
          itemsPerRequest,
        )
        // Filter out empty slots from the results.
        const encodedItems = (result[0] as QueriedItem[]).filter(
          (row) => row.ID !== ZERO_BYTES32,
        )
        setFetchItems({
          isFetching: false,
          fetchStarted: false,
          data: encodedItems,
          connectedTCRAddr,
        })
      } catch (err) {
        console.error('Error fetching items', err)
        setError('The badge lists could not be fetched.')
        setIsFetchingBadges(false)
        setFetchItems({ isFetching: false, fetchStarted: false })
      }
    })()
  }, [gtcrView, connectedTCRAddr, fetchItems, gtcr])

  // Decode the rows once both the rows and the columns are in.
  const enabledBadges = useMemo(() => {
    if (!fetchItems.data || !connectedColumns) return

    return fetchItems.data.map((row) => {
      let decodedItem: unknown[] | undefined
      const errors: string[] = []
      try {
        decodedItem = gtcrDecode({
          values: row.data,
          columns: connectedColumns,
        })
      } catch {
        errors.push(`Error decoding item ${row.ID} of TCR at ${tcrAddress}`)
      }

      // The row's columns along with its TCR status data.
      return {
        tcrData: { ...row }, // Spread to convert from array to object.
        columns: connectedColumns.map((col, i) => ({
          value: decodedItem && decodedItem[i],
          ...col,
        })),
        errors,
      }
    })
  }, [fetchItems, connectedColumns, tcrAddress])

  // With the badge list addresses and the match files, search each badge
  // list for this entry.
  useEffect(() => {
    if (!enabledBadges || !gtcrView || !item) return
    if (!getLogs) return
    let cancelled = false
    ;(async () => {
      const found: FoundBadge[] = []
      const connected: BadgeInfo[] = []
      try {
        await Promise.all(
          enabledBadges.map(async ({ columns }) => {
            const badgeAddr = columns[0].value as string
            const matchFileURI = columns[1].value as string
            const badgeContract = new ethers.Contract(badgeAddr, _gtcr, library)

            // Get the badge contract metadata.
            const logs = (
              await getLogs({
                ...badgeContract.filters.MetaEvidence(),
                fromBlock: 0,
              })
            ).map((log) => badgeContract.interface.parseLog(log))
            if (logs.length === 0) {
              console.warn('Could not fetch metadata for contract', badgeAddr)
              return
            }

            const { _evidence: metaEvidencePath } = logs[logs.length - 1].args
            const [badgeMetaEvidenceResponse, matchFileResponse, badgeTcrData] =
              await Promise.all([
                fetch(parseIpfs(metaEvidencePath)),
                fetch(parseIpfs(matchFileURI)),
                gtcrView.fetchArbitrable(badgeAddr),
              ])
            const itemCount = (await badgeContract.itemCount()).toNumber()
            const badgeMetaEvidence = await badgeMetaEvidenceResponse.json()
            const matchFile = await matchFileResponse.json()
            const { columns: matchColumns } = matchFile
            const { metadata: badgeMetadata, fileURI } = badgeMetaEvidence

            // Submission deposit = submitter base deposit + arbitration fee
            const { submissionBaseDeposit, arbitrationCost } = badgeTcrData
            const submissionDeposit = submissionBaseDeposit.add(arbitrationCost)

            const { decodedData } = item

            connected.push({
              metadata: badgeMetadata,
              submissionDeposit,
              baseDeposit: submissionBaseDeposit,
              arbitrationCost,
              metaEvidence: badgeMetaEvidence,
              tcrAddress: badgeAddr,
              fileURI,
              matchFile,
              decodedData,
              challengePeriodDuration: badgeTcrData.challengePeriodDuration,
            })

            // Search for the item on the badge TCR.
            const encodedMatch = gtcrEncode({
              columns: badgeMetadata.columns,
              values: badgeMetadata.columns
                .map((col: Column) => col.label)
                .reduce(
                  (acc: Record<string, unknown>, curr: string, i: number) => ({
                    ...acc,
                    [curr]:
                      matchColumns[i] !== null
                        ? decodedData?.[matchColumns[i]]
                        : undefined,
                  }),
                  {},
                ),
            })

            const itemsPerRequest = 100
            for (let i = 0; i < Math.ceil(itemCount / itemsPerRequest); i++) {
              const cursor =
                i > 0 && i < itemCount - 1 ? i * itemsPerRequest + 1 : 0
              const ignoreColumns = matchColumns.map(
                (col: unknown) => typeof col !== 'number',
              )
              const result = (
                await gtcrView.findItem(
                  badgeAddr,
                  encodedMatch,
                  cursor,
                  itemsPerRequest > itemCount ? 0 : itemsPerRequest,
                  [true, false, false, false], // Whether to skip items in the [absent, registered, submitted, removalRequested] states.
                  ignoreColumns,
                )
              ).filter((res: QueriedItem) => res.ID !== ZERO_BYTES32)
              if (result.length > 0) {
                found.push({
                  tcrAddress: badgeAddr,
                  item: { ...result[0] }, // Convert array to object.
                  metadata: badgeMetadata,
                  tcrData: badgeTcrData,
                })
                break
              }
            }
          }),
        )
      } catch (err) {
        console.error(err)
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'The badge lists could not be searched.',
          )
      } finally {
        if (!cancelled) {
          setIsFetchingBadges(false)
          setFoundBadges(found)
          setConnectedBadges(connected)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabledBadges, gtcrView, item, library, getLogs])

  // Every connected badge list can be offered; the badge modal leaves out
  // the lists this entry is already on.
  const availableBadges = useMemo(
    () => (enabledBadges ? connectedBadges : []),
    [connectedBadges, enabledBadges],
  )

  const onSelectBadge = useCallback((selectedBadge: BadgeInfo) => {
    setSubmissionFormOpen(true)
    setBadgeToSubmit(selectedBadge)
  }, [])

  const now = timestamp ? timestamp.toNumber() : Math.floor(Date.now() / 1000)

  return (
    <Surface
      id="badges"
      $padding="standard"
      role="region"
      aria-label="Badges"
      aria-busy={isFetchingBadges || undefined}
    >
      <Head>
        <PanelName>
          Badges
          {foundBadges.length > 0 && <Chip>{foundBadges.length}</Chip>}
        </PanelName>
        <Button
          type="button"
          $variant="ghost"
          $size="sm"
          onClick={() => setAddBadgeVisible(true)}
        >
          <CurateIcon name="verified" size={14} />
          Add a badge
        </Button>
      </Head>

      {error ? (
        <Notice tone="contested" role="alert">
          {error}
        </Notice>
      ) : isFetchingBadges && foundBadges.length === 0 ? (
        <Rows aria-hidden>
          <SkeletonBlock $height="64px" style={{ borderRadius: 14 }} />
        </Rows>
      ) : foundBadges.length > 0 ? (
        <Rows>
          {foundBadges.map(
            (
              {
                tcrAddress: badgeAddress,
                item: badgeItem,
                metadata: { logoURI, tcrTitle, tcrDescription },
                tcrData: { challengePeriodDuration },
              },
              i,
            ) => (
              <BadgeRow
                key={badgeAddress}
                to={`/tcr/${chainId}/${badgeAddress}/${badgeItem.ID}`}
                style={{ ['--i' as string]: i }}
              >
                {logoURI ? (
                  <Logo src={parseIpfs(logoURI)} alt="" />
                ) : (
                  <LogoFallback aria-hidden>
                    <CurateIcon name="registry" size={20} />
                  </LogoFallback>
                )}
                <Identity>
                  <strong title={tcrTitle}>{tcrTitle || 'Badge list'}</strong>
                  <StatusSlot>
                    <ItemStatusBadge
                      statusCode={badgeStatusCode(
                        badgeItem,
                        challengePeriodDuration,
                        now,
                      )}
                    />
                  </StatusSlot>
                  {tcrDescription && (
                    <Small $muted title={tcrDescription}>
                      {tcrDescription.length > 120
                        ? `${tcrDescription.slice(0, 119)}…`
                        : tcrDescription}
                    </Small>
                  )}
                </Identity>
                <CurateIcon name="external" size={16} />
              </BadgeRow>
            ),
          )}
        </Rows>
      ) : (
        <Empty>
          <CurateIcon name="verified" size={18} />
          Not on any badge list of this registry yet.
        </Empty>
      )}

      <AddBadgeModal
        visible={addBadgeVisible}
        onCancel={() => setAddBadgeVisible(false)}
        availableBadges={availableBadges}
        connectedTCRAddr={connectedTCRAddr}
        tcrAddress={tcrAddress}
        foundBadges={foundBadges}
        onSelectBadge={onSelectBadge}
        onEnableNewBadge={() => setSubmitConnectVisible(true)}
        isFetchingBadges={isFetchingBadges && !error}
      />
      {badgeToSubmit && (
        <SubmitModal
          visible={submissionFormOpen}
          onCancel={() => setSubmissionFormOpen(false)}
          submissionDeposit={badgeToSubmit.submissionDeposit}
          baseDeposit={badgeToSubmit.baseDeposit}
          arbitrationCost={badgeToSubmit.arbitrationCost}
          challengePeriodDuration={badgeToSubmit.challengePeriodDuration}
          tcrAddress={badgeToSubmit.tcrAddress}
          metaEvidence={badgeToSubmit.metaEvidence}
          initialValues={badgeToSubmit.matchFile?.columns.map((col) =>
            col !== null ? badgeToSubmit.decodedData?.[col] : null,
          )}
          disabledFields={badgeToSubmit.matchFile?.columns.map(
            (col) => col !== null,
          )}
        />
      )}
      <SubmitConnectModal
        visible={submitConnectVisible}
        onCancel={() => setSubmitConnectVisible(false)}
        initialValues={tcrAddress ? [tcrAddress] : undefined}
        tcrAddress={connectedTCRAddr}
        gtcrView={gtcrView}
      />
    </Surface>
  )
}

export default Badges
