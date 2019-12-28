import React, { useState, useContext, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Card, Icon, Tooltip, Button } from 'antd'
import DisplaySelector from './display-selector'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { abi as _batchWithdraw } from '@kleros/tcr/build/contracts/BatchWithdraw.json'
import { bigNumberify } from 'ethers/utils'
import { ethers } from 'ethers'
import Reward from 'react-rewards'
import { TCRViewContext } from '../bootstrap/tcr-view-context'
import itemPropTypes from '../prop-types/item'
import { WalletContext } from '../bootstrap/wallet-context'
import useNetworkEnvVariable from '../hooks/network-env'

const StyledFields = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`

const StyledField = styled.div`
  margin-bottom: 16px;
  margin-right: 16px;
  word-break: break-word;
`

const ItemDetailsCard = ({ title, columns, loading, item }) => {
  const { account, networkId } = useWeb3Context()
  const { pushWeb3Action } = useContext(WalletContext)
  const { gtcrView, tcrAddress } = useContext(TCRViewContext)
  const [availableRewards, setAvailableRewards] = useState()
  const [rewardRef, setRewardRef] = useState()
  const BATCH_WITHDRAW_ADDRESS = useNetworkEnvVariable(
    'REACT_APP_BATCH_WITHDRAW_ADDRESSES',
    networkId
  )

  // Fetch available rewards from fee contributions.
  useEffect(() => {
    ;(async () => {
      if (!gtcrView || !account || !item) return
      setAvailableRewards(
        await gtcrView.availableRewards(tcrAddress, item.ID, account)
      )
    })()
  }, [account, gtcrView, item, tcrAddress])

  const batchWithdrawClick = useCallback(() => {
    rewardRef.rewardMe()
    if (!BATCH_WITHDRAW_ADDRESS || !item) return
    pushWeb3Action(async (_, signer) => {
      const batchWithdraw = new ethers.Contract(
        BATCH_WITHDRAW_ADDRESS,
        _batchWithdraw,
        signer
      )
      const tx = await batchWithdraw.batchRequestWithdraw(
        tcrAddress,
        account,
        item.ID,
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
            await gtcrView.availableRewards(tcrAddress, item.ID, account)
          )
      }
    })
  }, [
    BATCH_WITHDRAW_ADDRESS,
    account,
    gtcrView,
    item,
    pushWeb3Action,
    rewardRef,
    tcrAddress
  ])

  return (
    <Card
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
      {columns && (
        <StyledFields>
          {columns.map((column, index) => (
            <StyledField key={index}>
              <span>
                {column.label}
                {column.description && (
                  <Tooltip title={column.description}>
                    &nbsp;
                    <Icon type="question-circle-o" />
                  </Tooltip>
                )}
              </span>
              :{' '}
              <DisplaySelector
                type={column.type}
                value={item && item.decodedData[index]}
              />
            </StyledField>
          ))}
        </StyledFields>
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
  loading: PropTypes.bool
}

ItemDetailsCard.defaultProps = {
  columns: null,
  title: null,
  item: null,
  loading: null
}

export default ItemDetailsCard
