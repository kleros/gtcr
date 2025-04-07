import React, { useState, useContext, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { Card, Icon, Tooltip, Button, Result, Alert } from 'antd'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import { useWeb3Context } from 'web3-react'
import { useParams } from 'react-router-dom'
import { abi as _batchWithdraw } from '@kleros/tcr/build/contracts/BatchWithdraw.json'
import { bigNumberify } from 'ethers/utils'
import { ethers } from 'ethers'
import Reward from 'react-rewards'
import { TCRViewContext } from 'contexts/tcr-view-context'
import itemPropTypes from '../prop-types/item'
import { WalletContext } from 'contexts/wallet-context'
import TCRMetadataDisplay from './tcr-metadata-display'
import { addPeriod } from '../utils/string'
import { batchWithdrawAddresses } from 'config/tcr-addresses'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'

const StyledFields = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
`

const StyledField = styled.div`
  margin-bottom: 16px;
  margin-right: 16px;
  word-break: break-word;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 12px;
`

const ItemDetailsCard = ({
  title,
  columns,
  loading,
  item,
  itemMetaEvidence
}) => {
  const { account, networkId } = useWeb3Context()
  const { pushWeb3Action } = useContext(WalletContext)
  const tcrViewContext = useContext(TCRViewContext)
  const [availableRewards, setAvailableRewards] = useState()
  const [rewardRef, setRewardRef] = useState()
  const BATCH_WITHDRAW_ADDRESS = batchWithdrawAddresses[networkId]
  const { chainId, tcrAddress } = useParams()

  // Fetch available rewards from fee contributions.
  useEffect(() => {
    ;(async () => {
      if (!tcrViewContext || !tcrViewContext.gtcrView || !account || !item)
        return

      setAvailableRewards(
        await tcrViewContext.gtcrView.availableRewards(
          tcrViewContext.tcrAddress,
          item.itemID,
          account
        )
      )
    })()
  }, [account, item, tcrViewContext])

  const batchWithdrawClick = useCallback(() => {
    rewardRef.rewardMe()
    if (!tcrViewContext || !BATCH_WITHDRAW_ADDRESS || !item) return
    pushWeb3Action(async (_, signer) => {
      const batchWithdraw = new ethers.Contract(
        BATCH_WITHDRAW_ADDRESS,
        _batchWithdraw,
        signer
      )
      const tx = await batchWithdraw.batchRequestWithdraw(
        tcrViewContext.tcrAddress,
        account,
        item.itemID,
        0,
        0,
        0,
        0
      )
      return {
        tx,
        actionMessage: 'Withdrawing Rewards',
        onTxMined: async () =>
          setAvailableRewards(
            await tcrViewContext.gtcrView.availableRewards(
              tcrViewContext.tcrAddress,
              item.itemID,
              account
            )
          )
      }
    })
  }, [
    BATCH_WITHDRAW_ADDRESS,
    account,
    item,
    pushWeb3Action,
    rewardRef,
    tcrViewContext
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
    <Card
      id="item-details-card"
      title={title}
      loading={loading}
      extra={
        item &&
        item.resolved &&
        availableRewards &&
        batchWithdrawClick &&
        availableRewards.gt(bigNumberify(0)) && (
          <Reward
            ref={ref => {
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
              </span>
              :{' '}
              <DisplaySelector
                type={column.type}
                value={item && item.decodedData[index]}
                linkImage
                allowedFileTypes={column.allowedFileTypes}
              />
            </StyledField>
          ))}
        </StyledFields>
      )}
      {tcrAddress !== undefined &&
        chainId !== undefined &&
        isSeerRegistry(tcrAddress, chainId) &&
        item && (
          <SeerExtraDetails
            chainId={chainId}
            contractAddress={item.decodedData[0]}
            imagesIpfsHash={item.decodedData[1]}
          />
        )}
    </Card>
  )
}

ItemDetailsCard.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired
    })
  ),
  title: PropTypes.string,
  item: itemPropTypes,
  loading: PropTypes.bool,
  itemMetaEvidence: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.shape({
      file: PropTypes.shape({
        metadata: PropTypes.shape({
          tcrTitle: PropTypes.string.isRequired,
          tcrDescription: PropTypes.string.isRequired,
          logoURI: PropTypes.string
        }).isRequired,
        fileURI: PropTypes.string.isRequired
      }).isRequired,
      error: PropTypes.string
    })
  ])
}

ItemDetailsCard.defaultProps = {
  columns: null,
  title: null,
  item: null,
  loading: null,
  itemMetaEvidence: null
}

export default ItemDetailsCard
