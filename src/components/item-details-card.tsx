import React, { useState, useEffect, useCallback, useContext } from 'react'
import styled from 'styled-components'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { useParams } from 'react-router-dom'
import { BigNumber } from 'ethers'
import { abi as _batchWithdraw } from '@kleros/tcr/build/contracts/BatchWithdraw.json'
import { ItemTypes } from '@kleros/gtcr-encoder'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { TCRViewContext } from 'contexts/tcr-view-context'
import { batchWithdrawAddresses } from 'config/tcr-addresses'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { parseIpfs } from 'utils/ipfs-parse'
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
} from 'components/curate/item-light-fields'
import { Notice } from 'components/curate/item-light-notice'
import { formatAmount } from 'components/curate/item-light-format'

/*
 * The entry's fields: every field as a label/value row rendered by its
 * type, separated by hairlines, less any the page already shows in full.
 * For a list of lists it also shows the linked registry's identity, its
 * policy and a link to it.
 * Classic lists keep the fee-reward withdrawal here. Shared by the Light,
 * Classic and Stake item pages and by the factory previews.
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
  background: ${({ $image }) =>
    $image ? `url(${$image}) center / contain no-repeat` : 'none'};
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
  disabled?: boolean
  /**
   * Fields the page already shows in full elsewhere (the item hero's
   * identifiers), left out of the list so no row repeats them.
   */
  exclude?: EntryField[]
}

const ItemDetailsCard = ({
  title,
  columns,
  loading,
  item,
  itemMetaEvidence,
  exclude,
}: ItemDetailsCardProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const tcrViewContext = useContext(TCRViewContext)
  const [availableRewards, setAvailableRewards] = useState<BigNumber>()
  const BATCH_WITHDRAW_ADDRESS = batchWithdrawAddresses[chainId]
  const { tcrAddress } = useParams()
  const urlChainId = useUrlChainId()
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()

  // Fetch available rewards from fee contributions (Classic view contract).
  useEffect(() => {
    ;(async () => {
      if (!tcrViewContext || !tcrViewContext.gtcrView || !account || !item)
        return

      setAvailableRewards(
        await tcrViewContext.gtcrView.availableRewards(
          tcrViewContext.tcrAddress,
          item.itemID,
          account,
        ),
      )
    })()
  }, [account, item, tcrViewContext])

  const batchWithdrawClick = useCallback(async () => {
    if (
      !tcrViewContext ||
      !BATCH_WITHDRAW_ADDRESS ||
      !item ||
      !walletClient ||
      !publicClient
    )
      return

    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: BATCH_WITHDRAW_ADDRESS as `0x${string}`,
        abi: _batchWithdraw,
        functionName: 'batchRequestWithdraw',
        args: [tcrViewContext.tcrAddress, account, item.itemID, 0, 0, 0, 0],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
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
  }, [
    BATCH_WITHDRAW_ADDRESS,
    account,
    item,
    publicClient,
    tcrViewContext,
    walletClient,
  ])

  const { file: itemMetaEvidenceFile, error: itemMetaEvidenceError } =
    itemMetaEvidence || {}
  const { metadata: itemMetaData, fileURI } = itemMetaEvidenceFile || {}
  const { tcrTitle, tcrDescription, logoURI } = itemMetaData || {}
  const itemMetaEvidenceErrorMessage =
    itemMetaEvidenceError instanceof Error
      ? itemMetaEvidenceError.message
      : String(itemMetaEvidenceError)
  const childRegistryAddress =
    itemMetaData && item?.decodedData?.[0]
      ? String(item.decodedData[0])
      : undefined
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
    !!item &&
    !!item.resolved &&
    !!availableRewards &&
    availableRewards.gt(BigNumber.from(0))
  const logo = logoURI ? parseIpfs(logoURI) : undefined

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
        {withdrawable && (
          <Actions>
            <Button
              type="button"
              $variant="primary"
              $size="sm"
              onClick={batchWithdrawClick}
            >
              Withdraw rewards ·{' '}
              {formatAmount(availableRewards, nativeCurrency)}
            </Button>
          </Actions>
        )}
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
