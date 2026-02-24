import React, { useState, useEffect, useCallback, useContext } from 'react'
import styled from 'styled-components'
import { Card, Tooltip, Button, Result, Alert } from 'components/ui'
import Icon from 'components/ui/Icon'
import DisplaySelector from './display-selector'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { useParams } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { abi as _batchWithdraw } from '@kleros/tcr/build/contracts/BatchWithdraw.json'
import { BigNumber } from 'ethers'
import Reward from 'react-rewards'
import { TCRViewContext } from 'contexts/tcr-view-context'
import TCRMetadataDisplay from './tcr-metadata-display'
import { addPeriod } from '../utils/string'
import { batchWithdrawAddresses } from 'config/tcr-addresses'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'

const StyledCard = styled(Card)`
  .ui-card-head {
    background: ${({ theme }) => theme.cardHeaderGradient};
    color: white;
    border-color: ${({ theme }) =>
      theme.name === 'dark' ? theme.borderColor : 'transparent'};
  }

  .ui-card-head-title {
    color: white;
  }

  .ui-card-extra {
    color: white;
  }
`

const StyledFields = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: baseline;
`

const StyledField = styled.div`
  word-break: break-word;
  font-size: 14px;

  > span:first-child {
    margin-right: 4px;
    white-space: nowrap;
  }

  p {
    display: inline;
    margin: 0;
  }

  div {
    margin: 0;
  }
`

const StyledAlert = styled(Alert)`
  margin-bottom: 12px;
`

interface ItemDetailsCardProps {
  title?: string | null
  columns?: Column[] | null
  loading?: boolean | null
  item?: SubgraphItem
  itemMetaEvidence?: MetaEvidence | false
  disabled?: boolean
}

const ItemDetailsCard = ({
  title,
  columns,
  loading,
  item,
  itemMetaEvidence,
  disabled = false,
}: ItemDetailsCardProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const tcrViewContext = useContext(TCRViewContext)
  const [availableRewards, setAvailableRewards] = useState()
  const [rewardRef, setRewardRef] = useState()
  const BATCH_WITHDRAW_ADDRESS = batchWithdrawAddresses[chainId]
  const { tcrAddress } = useParams()
  const urlChainId = useUrlChainId()

  // Fetch available rewards from fee contributions.
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
    rewardRef.rewardMe()
    if (!tcrViewContext || !BATCH_WITHDRAW_ADDRESS || !item) return

    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: BATCH_WITHDRAW_ADDRESS,
        abi: _batchWithdraw,
        functionName: 'batchRequestWithdraw',
        args: [tcrViewContext.tcrAddress, account, item.itemID, 0, 0, 0, 0],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status)
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
    rewardRef,
    tcrViewContext,
    walletClient,
  ])

  const { file: itemMetaEvidenceFile, error: itemMetaEvidenceError } =
    itemMetaEvidence || {}
  const { metadata: itemMetaData, fileURI } = itemMetaEvidenceFile || {}
  const { tcrTitle, tcrDescription, logoURI } = itemMetaData || {}

  if (!loading && item && item.errors.length > 0)
    return (
      <Result
        id="item-details-card"
        status="warning"
        subTitle={item.errors.map((e, i) => (
          <p key={i}>{e}</p>
        ))}
        style={{ width: '100%' }}
      />
    )

  return (
    <StyledCard
      id="item-details-card"
      title={title}
      loading={loading}
      extra={
        item &&
        item.resolved &&
        availableRewards &&
        batchWithdrawClick &&
        availableRewards.gt(BigNumber.from(0)) && (
          <Reward
            ref={(ref) => {
              setRewardRef(ref)
            }}
            type="confetti"
          >
            <Button onClick={batchWithdrawClick}>Withdraw Rewards</Button>
          </Reward>
        )
      }
    >
      {itemMetaEvidenceError && (
        <StyledAlert
          message={`Warning: Malformed submission, cannot display TCR information. Error: ${itemMetaEvidenceError.message}`}
          type="warning"
          showIcon
          closable
        />
      )}
      {columns && (
        <StyledFields>
          {itemMetaData && (
            <TCRMetadataDisplay
              logoURI={logoURI}
              tcrTitle={tcrTitle}
              fileURI={fileURI}
              tcrDescription={tcrDescription}
            />
          )}
          {columns.map((column, index) => (
            <StyledField key={index}>
              <span>
                <b>{column.label}</b>
                {column.description && (
                  <Tooltip title={addPeriod(column.description)}>
                    &nbsp;
                    <Icon type="question-circle-o" />
                  </Tooltip>
                )}
                :
              </span>{' '}
              <DisplaySelector
                type={column.type}
                value={item && item.decodedData[index]}
                linkImage
                allowedFileTypes={column.allowedFileTypes}
                disabled={disabled}
              />
            </StyledField>
          ))}
        </StyledFields>
      )}
      {tcrAddress !== undefined &&
        urlChainId !== undefined &&
        isSeerRegistry(tcrAddress, urlChainId) &&
        item && (
          <SeerExtraDetails
            chainId={urlChainId}
            contractAddress={item.decodedData[0]}
            imagesIpfsHash={item.decodedData[1]}
          />
        )}
    </StyledCard>
  )
}

export default ItemDetailsCard
