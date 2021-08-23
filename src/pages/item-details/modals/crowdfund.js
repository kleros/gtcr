import React, { useState, useContext, useMemo } from 'react'
import {
  Modal,
  Descriptions,
  Button,
  Row,
  Col,
  Slider,
  InputNumber,
  Typography,
  Divider,
  Spin
} from 'antd'
import PropTypes from 'prop-types'
import { STATUS_CODE, PARTY } from '../../../utils/item-status'
import itemPropTypes from '../../../prop-types/item'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import { formatEther, bigNumberify } from 'ethers/utils'
import ETHAmount from '../../../components/eth-amount'
import styled from 'styled-components/macro'
import { WalletContext } from '../../../bootstrap/wallet-context'
import _gtcr from '../../../assets/abis/LightGeneralizedTCR.json'
import { ethers } from 'ethers'
import useRequiredFees from '../../../hooks/required-fees'
import { TourContext } from '../../../bootstrap/tour-context'
import useNativeCurrency from '../../../hooks/native-currency'

const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const CrowdfundModal = ({ statusCode, item, fileURI, ...rest }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const {
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR,
    tcrAddress
  } = useContext(TCRViewContext)

  const [contributionShare, setContributionShare] = useState(1)
  const { currentRuling, hasPaid } = item
  const [userSelectedSide, setUserSelectedSide] = useState()
  const nativeCurrency = useNativeCurrency()

  const autoSelectedSide = useMemo(() => {
    if (
      currentRuling === PARTY.NONE ||
      (hasPaid[PARTY.REQUESTER] && hasPaid[PARTY.CHALLENGER]) ||
      (!hasPaid[PARTY.REQUESTER] && !hasPaid[PARTY.CHALLENGER])
    )
      return PARTY.NONE

    // Automatically set crowdfunding to the winner, if the arbitrator
    // gave a decisive ruling and we are in the second half of the appeal period.
    if (statusCode === STATUS_CODE.CROWDFUNDING_WINNER) return currentRuling

    // If one of the parties is fully funded but not the other, automatically set
    // the side to the pending side.
    return !hasPaid[PARTY.REQUESTER] ? PARTY.REQUESTER : PARTY.CHALLENGER
  }, [currentRuling, hasPaid, statusCode])

  const side = useMemo(() => userSelectedSide || autoSelectedSide, [
    autoSelectedSide,
    userSelectedSide
  ])

  const {
    requiredForSide,
    amountStillRequired,
    potentialReward
  } = useRequiredFees({
    side,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    currentRuling,
    item,
    MULTIPLIER_DIVISOR
  })

  if (!sharedStakeMultiplier || !potentialReward)
    return (
      <StyledModal title="Crowdfund Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  if (
    (currentRuling === PARTY.NONE || statusCode === STATUS_CODE.CROWDFUNDING) &&
    side === PARTY.NONE // User did not select a side to fund yet.
  )
    // Arbitrator refused to rule or the dispute is in the first half
    // of the appeal period. Let the user choose who to fund.
    return (
      <StyledModal
        title="Contribute Fees"
        footer={[
          <Button
            key="submitter"
            type="primary"
            onClick={() => setUserSelectedSide(PARTY.REQUESTER)}
          >
            Submitter
          </Button>,
          <Button
            key="challenger"
            type="primary"
            onClick={() => setUserSelectedSide(PARTY.CHALLENGER)}
          >
            Challenger
          </Button>
        ]}
        {...rest}
      >
        Which side do you want to fund?
      </StyledModal>
    )

  const crowdfundSide = () => {
    pushWeb3Action(async ({ account, networkId }, signer) => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
      const contribution = amountStillRequired
        .mul(
          bigNumberify(
            (contributionShare * MULTIPLIER_DIVISOR.toString()).toString()
          )
        )
        .div(MULTIPLIER_DIVISOR)

      const tx = await gtcr.fundAppeal(item.ID, side, {
        value: contribution
      })

      rest.onCancel() // Hide the modal after submitting the tx.
      return {
        tx,
        actionMessage: `Contributing fees to ${
          side === PARTY.REQUESTER ? 'Submitter' : 'Challenger'
        }`,
        onTxMined: () => {
          // Subscribe for notifications
          if (!process.env.REACT_APP_NOTIFICATIONS_API_URL || !networkId) return
          fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
            {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriberAddr: ethers.utils.getAddress(account),
                tcrAddr: ethers.utils.getAddress(tcrAddress),
                itemID: item.ID,
                networkID: networkId
              })
            }
          )
            .then(() => setUserSubscribed(true))
            .catch(err => {
              console.error('Failed to subscribe for notifications.', err)
            })
        }
      }
    })
  }

  return (
    <StyledModal
      {...rest}
      title={`Contribute Fees to ${
        side === PARTY.REQUESTER ? 'Submitter' : 'Challenger'
      }`}
      onOk={crowdfundSide}
      afterClose={() => {
        // Reset side after closing.
        setUserSelectedSide(PARTY.NONE)
        setContributionShare(1)
      }}
    >
      <Typography.Title level={4}>
        Read the&nbsp;
        <a
          href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Listing Criteria
        </a>
        .
      </Typography.Title>
      <Typography.Paragraph level={4}>
        Contribute {nativeCurrency} for a chance to win at most{' '}
        <ETHAmount
          decimals={4}
          amount={potentialReward
            .mul(bigNumberify(Math.ceil(contributionShare * 10000) || 1))
            .div(10000)}
          displayUnit={` ${nativeCurrency}`}
        />
        . You will earn up to this amount if the side you choose wins the next
        round of the dispute.
      </Typography.Paragraph>
      <Typography.Paragraph>
        How much {nativeCurrency} do you want to contribute?
      </Typography.Paragraph>
      <Row>
        <Col span={16}>
          <Slider
            min={0}
            max={1}
            step={0.001}
            onChange={value => setContributionShare(value)}
            value={contributionShare}
            tooltipVisible={false}
          />
        </Col>
        <Col span={8}>
          <InputNumber
            min={0}
            max={1}
            step={0.001}
            style={{ marginLeft: 16 }}
            value={
              amountStillRequired
                ? contributionShare * formatEther(amountStillRequired)
                : contributionShare
            }
            onChange={value => setContributionShare(value)}
          />{' '}
          {nativeCurrency}
        </Col>
      </Row>
      <Divider />
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Total Required:">
          <ETHAmount
            decimals={4}
            amount={requiredForSide}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Amount Paid:">
          <ETHAmount
            decimals={4}
            amount={item && item.amountPaid[side]}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

CrowdfundModal.propTypes = {
  statusCode: PropTypes.oneOf([
    STATUS_CODE.CROWDFUNDING,
    STATUS_CODE.CROWDFUNDING_WINNER
  ]).isRequired,
  item: itemPropTypes.isRequired,
  fileURI: PropTypes.string
}

CrowdfundModal.defaultProps = {
  fileURI: ''
}

export default CrowdfundModal
