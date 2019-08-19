import React, { useState, useEffect, useContext, useMemo } from 'react'
import {
  Modal,
  Descriptions,
  Button,
  Row,
  Col,
  Slider,
  InputNumber,
  Typography,
  Divider
} from 'antd'
import PropTypes from 'prop-types'
import { STATUS_CODE, PARTY } from '../../../utils/item-status'
import itemPropTypes from '../../../prop-types/item'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import { formatEther, bigNumberify } from 'ethers/utils'
import ETHAmount from '../../../components/eth-amount'
import { DisputeContext } from '../dispute-context'
import { WalletContext } from '../../../bootstrap/wallet-context'
import { abi as _gtcr } from '../../../assets/contracts/GTCRMock.json'
import { ethers } from 'ethers'

// TODO: If a party is already fully funded, only offer to crowdfund the other.
const CrowdfundModal = ({ statusCode, item, ...rest }) => {
  const { appealCost } = useContext(DisputeContext)
  const { pushWeb3Action } = useContext(WalletContext)
  const {
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR,
    tcrAddress
  } = useContext(TCRViewContext)

  const [side, setSide] = useState(PARTY.NONE)
  const [contributionShare, setContributionShare] = useState(1)
  const { currentRuling } = item

  useEffect(() => {
    // Automatically set crowdfunding to the winner, if the arbitrator
    // gave a decisive ruling and we are in the second half of the appeal period.
    if (
      side !== PARTY.NONE ||
      statusCode === STATUS_CODE.CROWDFUNDING ||
      currentRuling === PARTY.NONE
    )
      return
    setSide(currentRuling)
  }, [currentRuling, side, statusCode])

  // Calculate total of fees still required and potential rewards.
  const {
    requiredForSide,
    amountStillRequired,
    potentialReward
  } = useMemo(() => {
    if (
      side === PARTY.NONE ||
      !sharedStakeMultiplier ||
      !winnerStakeMultiplier ||
      !loserStakeMultiplier ||
      !MULTIPLIER_DIVISOR ||
      !currentRuling ||
      !appealCost
    )
      return {}

    const isFundingWinner =
      currentRuling !== PARTY.NONE
        ? null // Ignore if arbitrator did not give a decisive ruling.
        : currentRuling === PARTY.REQUESTER
        ? side === PARTY.REQUESTER
        : side === PARTY.CHALLENGER

    // Calculate the fee stake multiplier.
    // The fee stake is the reward shared among parties that crowdfunded
    // the appeal of the party that wins the dispute.
    const feeStakeMultiplier =
      currentRuling === PARTY.NONE
        ? sharedStakeMultiplier
        : isFundingWinner
        ? winnerStakeMultiplier
        : loserStakeMultiplier

    // Calculate full cost to fund the side.
    // Full appeal cost = appeal cost + appeal cost * fee stake multiplier.
    const requiredForSide = appealCost.add(
      appealCost.mul(feeStakeMultiplier).div(MULTIPLIER_DIVISOR)
    )

    // Calculate amount still required to fully fund the side.
    const amountStillRequired = requiredForSide.sub(item.paidFees[side])

    // Calculate the max reward the user can earn by contributing fees.
    // Potential reward = appeal cost * opponent fee stake multiplier * share available for contribution.
    const opponentFeeStakeMultiplier =
      currentRuling === PARTY.NONE
        ? sharedStakeMultiplier
        : isFundingWinner
        ? loserStakeMultiplier
        : winnerStakeMultiplier

    // This is the total potential reward if the user contributed 100% of the fees.
    const totalReward = appealCost
      .mul(opponentFeeStakeMultiplier)
      .div(MULTIPLIER_DIVISOR)

    // Available reward = opponent fee stake * % contributions pending.
    const potentialReward = amountStillRequired
      .mul(MULTIPLIER_DIVISOR)
      .div(requiredForSide)
      .mul(totalReward)
      .div(MULTIPLIER_DIVISOR)

    return { requiredForSide, amountStillRequired, potentialReward }
  }, [
    MULTIPLIER_DIVISOR,
    appealCost,
    currentRuling,
    item.paidFees,
    loserStakeMultiplier,
    sharedStakeMultiplier,
    side,
    winnerStakeMultiplier
  ])

  if (
    (currentRuling === PARTY.NONE || statusCode === STATUS_CODE.CROWDFUNDING) &&
    side === PARTY.NONE // User did not select a side to fund yet.
  )
    // Arbitrator refused to rule or the dispute is in the first half
    // of the appeal period. Let the user choose who to fund.
    return (
      <Modal
        title="Contribute Fees"
        footer={[
          <Button
            key="submitter"
            type="primary"
            onClick={() => setSide(PARTY.REQUESTER)}
          >
            Requester
          </Button>,
          <Button
            key="challenger"
            type="primary"
            onClick={() => setSide(PARTY.CHALLENGER)}
          >
            Challenger
          </Button>
        ]}
        {...rest}
      >
        Which side do you want to fund?
      </Modal>
    )

  const crowdfundSide = () => {
    pushWeb3Action(async (_, signer) => {
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
          side === PARTY.REQUESTER ? 'Requester' : 'Challenger'
        }`
      }
    })
  }

  return (
    <Modal
      {...rest}
      title={`Contribute Fees to ${
        side === PARTY.REQUESTER ? 'Requester' : 'Challenger'
      }`}
      onOk={crowdfundSide}
      afterClose={() => {
        // Reset side after closing.
        setSide(PARTY.NONE)
        setContributionShare(1)
      }}
    >
      <Typography.Paragraph level={4}>
        Contribute ETH for a chance to win up to{' '}
        <ETHAmount decimals={4} amount={potentialReward} displayUnit />. You
        will earn up to this amount if the side you choose wins the next round
        of the dispute.
      </Typography.Paragraph>
      <Typography.Paragraph>
        How much ETH do you want to contribute?
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
          ETH
        </Col>
      </Row>
      <Divider />
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Total Required:">
          <ETHAmount decimals={4} amount={requiredForSide} displayUnit />
        </Descriptions.Item>
        <Descriptions.Item label="Amount Paid:">
          <ETHAmount
            decimals={4}
            amount={item && item.paidFees[side]}
            displayUnit
          />
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  )
}

CrowdfundModal.propTypes = {
  statusCode: PropTypes.oneOf([
    STATUS_CODE.CROWDFUNDING,
    STATUS_CODE.CROWDFUNDING_WINNER
  ]).isRequired,
  item: itemPropTypes.isRequired
}

export default CrowdfundModal
