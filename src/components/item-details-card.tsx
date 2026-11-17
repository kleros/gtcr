import React, { useState, useEffect, useCallback, useContext } from 'react'
import styled from 'styled-components'
import { useAccount, usePublicClient } from 'wagmi'
import { simulateContract, writeContract } from '@wagmi/core'
import { useParams } from 'react-router-dom'
import { BigNumber } from 'ethers'
import { abi as _batchWithdraw } from '@kleros/tcr/build/contracts/BatchWithdraw.json'
import { ItemTypes } from '@kleros/gtcr-encoder'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { StandardTCRViewContext } from 'contexts/standard-tcr-view-context'
import { standardBatchWithdrawAddresses } from 'config/tcr-addresses'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { parseIpfs } from 'utils/ipfs-parse'
import { cssImageUrl } from 'utils/url-validation'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import { CurateIcon } from 'components/curate/icons'
import {
  Body,
  Button,
  ButtonLink,
  Chip,
  Data,
  IconButton,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  Subheading,
  Surface,
  truncateMiddle,
} from 'components/curate/primitives'
import {
  EntryFields,
  type EntryField,
} from 'components/curate/item-standard-fields'
import { Notice } from 'components/curate/item-standard-notice'
import { formatAmount } from 'components/curate/item-standard-format'
import { useActionGate } from 'components/curate/item-standard-gate'
import {
  sendPhaseLabel,
  type SendPhase,
} from 'components/curate/what-happens-next'

/*
 * The entry's fields: every field as a label/value row rendered by its
 * type, separated by hairlines, less any the page already shows in full.
 * For a list of lists it also shows the linked registry's identity, its
 * policy and a link to it.
 * Standard lists keep the fee-reward withdrawal here. Shared by the Standard and
 * Stake item pages.
 */

/* A divider under it only when fields follow; when only the actions do,
   their own top border is the one line. */
const RegistryBlock = styled.div<{ $divided: boolean }>`
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 16px;
  ${({ $divided }) =>
    $divided &&
    `
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
  `}

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const LogoButton = styled.button<{ $image?: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: ${({ $image }) => {
    const image = cssImageUrl($image)
    return image ? `${image} center / contain no-repeat` : 'none'
  }};
  background-color: var(--color-raised);
  color: var(--color-faint);
  cursor: ${({ $image }) => ($image ? 'pointer' : 'default')};
  overflow: hidden;

  &:hover {
    border-color: var(--color-border-strong);
  }
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 8px;
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

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`

const CopyId = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])
  return (
    <Row $gap={4} title={id}>
      <Small $muted>ID</Small>
      <Data $mono $muted>
        {truncateMiddle(id, 8, 6)}
      </Data>
      <IconButton
        type="button"
        aria-label="Copy item ID"
        onClick={() => {
          navigator.clipboard
            ?.writeText(id)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }}
      >
        <CurateIcon name={copied ? 'check' : 'copy'} size={14} />
      </IconButton>
      {copied && (
        <Small $muted role="status">
          Copied
        </Small>
      )}
    </Row>
  )
}

/**
 * Withdraw rewards, gated like Execute: the batch withdrawer is on the
 * list's chain, so the wallet must be connected there (the card offers the
 * switch and names the blocker). Busy until the transaction settles, so a
 * second click cannot send a second one. Rendered only while there is
 * something to withdraw, so other pages pay for no balance read.
 */
const WithdrawRewards = ({
  amount,
  phase,
  onWithdraw,
}: {
  amount: string
  /** Where the withdrawal is while it is being sent. */
  phase?: SendPhase
  onWithdraw: () => void
}) => {
  const gate = useActionGate({ verb: 'withdraw rewards', needsAuth: false })
  const busy = !!phase
  return (
    <Actions>
      <Stack $gap={8}>
        <Row $gap={8} $wrap>
          <Button
            type="button"
            $variant="primary"
            $size="sm"
            disabled={!gate.ready || busy}
            aria-disabled={!gate.ready || busy}
            title={gate.ready ? undefined : gate.blocker}
            onClick={onWithdraw}
          >
            {busy ? sendPhaseLabel(phase) : `Withdraw rewards · ${amount}`}
          </Button>
          {gate.controls}
        </Row>
        {gate.blocker && (
          <Small $muted role="status">
            {gate.blocker}
          </Small>
        )}
      </Stack>
    </Actions>
  )
}

/** What the item-details pages resolve for a child registry's meta evidence. */
interface ItemMetaEvidenceState {
  file?: MetaEvidence
  error?: unknown
}

interface ItemDetailsCardProps {
  title?: string | null
  columns?: Column[] | null
  loading?: boolean | null
  item?: SubgraphItem
  itemMetaEvidence?: ItemMetaEvidenceState | false | null
  /**
   * On a list of lists, the list the entry points to, which the page read
   * `itemMetaEvidence` for: the field the seal reads, never simply the
   * entry's first field (a Standard entry's file orders its own columns).
   */
  registryAddress?: string
  disabled?: boolean
  /**
   * Fields the page already shows in full elsewhere (the item hero's
   * identifiers), left out of the list so no row repeats them.
   */
  exclude?: EntryField[]
  /**
   * The kind of list: Standard lists withdraw rewards through their batch
   * withdrawer; Stake lists settle rewards elsewhere, so they get no button
   * here.
   */
  kind?: 'standard' | 'stake'
}

const ItemDetailsCard = ({
  title,
  columns,
  loading,
  item,
  itemMetaEvidence,
  registryAddress,
  exclude,
  kind = 'standard',
}: ItemDetailsCardProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  // Standard pages provide the Standard view context: its view contract answers
  // availableRewards.
  const standardView = useContext(StandardTCRViewContext)
  const tcrViewContext = (kind === 'standard' ? standardView : undefined) as
    | {
        gtcrView?: {
          availableRewards: (...args: unknown[]) => Promise<BigNumber>
        }
        tcrAddress?: string
      }
    | undefined
  const [availableRewards, setAvailableRewards] = useState<BigNumber>()
  const [withdrawing, setWithdrawing] = useState<SendPhase>()
  // batchRequestWithdraw walks the requests from the first one, and the list
  // contract reverts a withdrawal from a request still under dispute. While
  // the latest request is open the walk stops before it (_count is where the
  // walk ends); the view's availableRewards
  // counts the same resolved requests. 0 walks them all, as before.
  const withdrawCount = item?.resolved
    ? 0
    : Math.max(0, (item?.requests?.length ?? 0) - 1)
  const { tcrAddress } = useParams()
  const urlChainId = useUrlChainId()
  // The batch withdrawer of the list's chain (the URL's), not the wallet's.
  // A chain without one gets no button rather than one that does nothing.
  const BATCH_WITHDRAW_ADDRESS =
    !urlChainId || kind === 'stake'
      ? undefined
      : standardBatchWithdrawAddresses[urlChainId]
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()

  // The figure is the connected account's: it goes as soon as the account
  // changes or disconnects, never offered to the next one.
  useEffect(() => setAvailableRewards(undefined), [account])

  // Fetch available rewards from fee contributions (the list's view
  // contract). Stake lists settle rewards elsewhere.
  useEffect(() => {
    if (kind === 'stake') return
    let cancelled = false
    void (async () => {
      if (!tcrViewContext || !tcrViewContext.gtcrView || !account || !item)
        return
      try {
        const rewards = await tcrViewContext.gtcrView.availableRewards(
          tcrViewContext.tcrAddress,
          item.itemID,
          account,
        )
        if (!cancelled) setAvailableRewards(rewards)
      } catch (err) {
        console.error('Could not read the available rewards', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account, item, tcrViewContext, kind])

  const batchWithdrawClick = useCallback(async () => {
    if (
      !tcrViewContext ||
      !BATCH_WITHDRAW_ADDRESS ||
      !urlChainId ||
      !item ||
      !publicClient
    )
      return

    setWithdrawing('wallet')
    try {
      // Simulated on the list's chain; writeContract refuses to send while
      // the wallet is on another one (the button's gate asks to switch).
      const { request } = await simulateContract(wagmiConfig, {
        address: BATCH_WITHDRAW_ADDRESS as `0x${string}`,
        abi: _batchWithdraw,
        functionName: 'batchRequestWithdraw',
        args: [
          tcrViewContext.tcrAddress,
          account,
          item.itemID,
          0,
          withdrawCount,
          0,
          0,
        ],
        account,
        chainId: urlChainId,
      })

      const result = await wrapWithToast(
        () =>
          writeContract(wagmiConfig, request).then((hash) => {
            setWithdrawing('mining')
            return hash
          }),
        publicClient,
      )

      if (result.status && tcrViewContext.gtcrView)
        setAvailableRewards(
          await tcrViewContext.gtcrView.availableRewards(
            tcrViewContext.tcrAddress,
            item.itemID,
            account,
          ),
        )
    } catch (err) {
      console.error('Error withdrawing rewards:', err)
      errorToast(parseWagmiError(err))
    }
    setWithdrawing(undefined)
  }, [
    BATCH_WITHDRAW_ADDRESS,
    account,
    item,
    publicClient,
    tcrViewContext,
    urlChainId,
    withdrawCount,
  ])

  const { file: itemMetaEvidenceFile, error: itemMetaEvidenceError } =
    itemMetaEvidence || {}
  const { metadata: itemMetaData, fileURI } = itemMetaEvidenceFile || {}
  const { tcrTitle, tcrDescription, logoURI } = itemMetaData || {}
  const itemMetaEvidenceErrorMessage =
    itemMetaEvidenceError instanceof Error
      ? itemMetaEvidenceError.message
      : String(itemMetaEvidenceError)
  const childRegistryAddress = itemMetaData ? registryAddress : undefined
  const excluded = new Set(
    (exclude ?? []).map((field) => `${field.label}\u0000${field.type}`),
  )
  const detailFields: EntryField[] =
    columns
      ?.map((column, index) => ({
        ...column,
        value: item && item.decodedData?.[index],
      }))
      .filter(
        (field) =>
          excluded.size === 0 ||
          !excluded.has(`${field.label}\u0000${field.type}`),
      )
      .filter((field) => {
        if (!itemMetaData) return true
        const type = String(field.type || '').toLowerCase()
        return (
          type !== String(ItemTypes.GTCR_ADDRESS).toLowerCase() &&
          type !== 'gtcr address'
        )
      }) || []
  const errors = item?.errors ?? []
  const withdrawable =
    !!BATCH_WITHDRAW_ADDRESS &&
    !!item &&
    (!!item.resolved || withdrawCount > 0) &&
    !!availableRewards &&
    availableRewards.gt(BigNumber.from(0))
  const logo = logoURI ? parseIpfs(logoURI) : undefined
  // Rewards do not depend on the entry's data, so an entry that cannot be
  // decoded still offers them.
  const withdrawAction = withdrawable ? (
    <WithdrawRewards
      amount={formatAmount(availableRewards, nativeCurrency)}
      phase={withdrawing}
      onWithdraw={batchWithdrawClick}
    />
  ) : null

  if (!loading && item && errors.length > 0)
    return (
      <Surface id="item-details-card" $padding="standard">
        <Stack $gap={10}>
          <PanelName>{title || 'Fields'}</PanelName>
          {errors.map((error, index) => (
            <Notice key={index} tone="contested" role="alert">
              {error}
            </Notice>
          ))}
          {withdrawAction}
        </Stack>
      </Surface>
    )

  if (loading)
    return (
      <Surface id="item-details-card" $padding="standard" aria-busy="true">
        <Stack $gap={12}>
          <SkeletonBlock $height="18px" $width="40%" />
          <SkeletonBlock $height="20px" />
          <SkeletonBlock $height="20px" $width="70%" />
          <SkeletonBlock $height="20px" $width="55%" />
        </Stack>
      </Surface>
    )

  return (
    <Surface
      id="item-details-card"
      $padding="standard"
      aria-label={title || undefined}
    >
      <Head>
        <PanelName>
          {title || 'Fields'}
          {detailFields.length > 0 && <Chip>{detailFields.length}</Chip>}
        </PanelName>
        {item?.itemID && <CopyId id={item.itemID} />}
      </Head>
      <Stack $gap={16}>
        {!!itemMetaEvidenceError && (
          <Notice tone="contested" role="alert">
            Malformed submission: the linked registry could not be read (
            {itemMetaEvidenceErrorMessage}).
          </Notice>
        )}
        {!item?.decodedData?.length && !columns?.length ? (
          <Notice tone="contested">
            This entry does not pass the validation checks. Review it carefully.
          </Notice>
        ) : null}
        {itemMetaData && (
          <RegistryBlock $divided={detailFields.length > 0}>
            <LogoButton
              type="button"
              $image={logo}
              disabled={!logo}
              aria-label="Open registry logo"
              onClick={() => logo && openAttachment(logo)}
            >
              {!logo && <CurateIcon name="registry" size={24} />}
            </LogoButton>
            <Stack $gap={6}>
              <Subheading>{tcrTitle}</Subheading>
              {/* The address field stays out of the rows below (this block
                  stands for it), so its address shows here. */}
              {childRegistryAddress && (
                <Data $mono $muted title={childRegistryAddress}>
                  {truncateMiddle(childRegistryAddress, 8, 6)}
                </Data>
              )}
              {tcrDescription && <Body $muted>{tcrDescription}</Body>}
              {(fileURI || (childRegistryAddress && urlChainId)) && (
                <Row $gap={8} $wrap>
                  {fileURI && (
                    <Button
                      type="button"
                      $variant="ghost"
                      $size="sm"
                      aria-label={`${tcrTitle || 'Linked list'} listing policy`}
                      onClick={() => openAttachment(parseIpfs(fileURI), true)}
                    >
                      <CurateIcon name="policy" size={14} />
                      Its policy
                    </Button>
                  )}
                  {childRegistryAddress && urlChainId && (
                    <ButtonLink
                      to={`/tcr/${urlChainId}/${childRegistryAddress}`}
                      $variant="secondary"
                      $size="sm"
                    >
                      Open registry
                      <CurateIcon name="external" size={14} />
                    </ButtonLink>
                  )}
                </Row>
              )}
            </Stack>
          </RegistryBlock>
        )}
        {columns && detailFields.length > 0 && (
          <EntryFields fields={detailFields} />
        )}
        {withdrawAction}
        {tcrAddress !== undefined &&
          urlChainId !== null &&
          isSeerRegistry(tcrAddress, urlChainId) &&
          item &&
          typeof item.decodedData?.[0] === 'string' &&
          typeof item.decodedData?.[1] === 'string' && (
            <SeerExtraDetails
              chainId={urlChainId}
              contractAddress={item.decodedData[0]}
              imagesIpfsHash={item.decodedData[1]}
            />
          )}
      </Stack>
    </Surface>
  )
}

export default ItemDetailsCard
