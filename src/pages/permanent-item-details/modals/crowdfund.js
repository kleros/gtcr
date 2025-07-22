import React, { useState, useContext, useMemo } from 'react'
import {
  Descriptions,
  Button,
  Row,
  Col,
  Slider,
  InputNumber,
  Typography,
  Divider
} from 'antd'
import { STATUS_CODE, PARTY, SUBGRAPH_RULING } from 'utils/permanent-item-status'
import { formatEther, parseEther, bigNumberify } from 'ethers/utils'
import ETHAmount from 'components/eth-amount'
import { WalletContext } from 'contexts/wallet-context'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { ethers } from 'ethers'
import useRequiredFees from 'hooks/required-fees'
import useNativeCurrency from 'hooks/native-currency'
import { parseIpfs } from 'utils/ipfs-parse'
import { StyledSpin, StyledModal } from './challenge'

const CrowdfundModal = ({ statusCode, item, fileURI, appealCost, ...rest }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const {
    id: tcrAddress,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier
  } = item?.registry || {}

  const MULTIPLIER_DIVISOR = 10_000

  const [contributionShare, setContributionShare] = useState(1)
  const [userSelectedSide, setUserSelectedSide] = useState()
  const nativeCurrency = useNativeCurrency()

  const round = item.challenges[0].rounds[0]
  const {
    hasPaidRequester,
    hasPaidChallenger,
    currentRuling,
    ruling,
    amountPaidRequester,
    amountPaidChallenger
  } = round

  const winner =
    ruling === SUBGRAPH_RULING.ACCEPT ? PARTY.REQUESTER : PARTY.CHALLENGER

  const autoSelectedSide = useMemo(() => {
    if (
      currentRuling === PARTY.NONE ||
      (hasPaidRequester && hasPaidChallenger) ||
      (!hasPaidRequester && !hasPaidChallenger)
    )
      return PARTY.NONE

    // Automatically set crowdfunding to the winner, if the arbitrator
    // gave a decisive ruling and we are in the second half of the appeal period.
    if (statusCode === STATUS_CODE.CROWDFUNDING_WINNER) return winner

    // If one of the parties is fully funded but not the other, automatically set
    // the side to the pending side.
    return !hasPaidRequester ? PARTY.REQUESTER : PARTY.CHALLENGER
  }, [currentRuling, hasPaidRequester, hasPaidChallenger, statusCode, winner])

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
    MULTIPLIER_DIVISOR,
    appealCost
  })

  if (!sharedStakeMultiplier || !potentialReward)
    return (
      <StyledModal title="Crowdfund Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  if (
    (currentRuling === SUBGRAPH_RULING.NONE ||
      statusCode === STATUS_CODE.CROWDFUNDING) &&
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
    pushWeb3Action(async (_, signer) => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
      const contribution = amountStillRequired
        .mul(
          bigNumberify(
            (contributionShare * MULTIPLIER_DIVISOR.toString()).toString()
          )
        )
        .div(MULTIPLIER_DIVISOR)

      const tx = await gtcr.fundAppeal(item.itemID, side, {
        value: contribution
      })

      rest.onCancel() // Hide the modal after submitting the tx.

      return {
        tx,
        actionMessage: `Contributing fees to ${
          side === PARTY.REQUESTER ? 'Submitter' : 'Challenger'
        }`
      }
    })
  }

  const amountPaid = side === 1 ? amountPaidRequester : amountPaidChallenger

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
          href={parseIpfs(fileURI || '')}
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
            // Careful: this max could be strictly lower?
            max={formatEther(amountStillRequired)}
            step={0.01}
            style={{ marginLeft: 16 }}
            value={
              amountStillRequired
                ? contributionShare * formatEther(amountStillRequired)
                : contributionShare
            }
            onChange={value => {
              // convert value to wei
              const weiAmount = parseEther(String(value))
              // get share
              const shareInBasis = weiAmount
                .mul(MULTIPLIER_DIVISOR)
                .div(amountStillRequired)
              setContributionShare(shareInBasis.toNumber() / MULTIPLIER_DIVISOR)
            }}
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
            amount={amountPaid}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default CrowdfundModal
