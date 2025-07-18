import React, { useContext } from 'react'
import styled from 'styled-components'
import { Modal, Descriptions, Typography, Button, Spin } from 'antd'
import PropTypes from 'prop-types'
import { ethers } from 'ethers'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { STATUS_CODE } from 'utils/permanent-item-status'
import ETHAmount from 'components/eth-amount'
import { WalletContext } from 'contexts/wallet-context'
import itemPropTypes from 'prop-types/item'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish.js'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { TourContext } from 'contexts/tour-context'
import { parseIpfs } from 'utils/ipfs-parse'
import { BigNumber } from 'ethers/utils'

export const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

export const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const ChallengeModal = ({
  item,
  itemName,
  statusCode,
  onCancel,
  arbitrationCost,
  ...rest
}) => {
  const registry = item.registry
  const fileURI = registry.arbitrationSettings[0].metadata.policyURI
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  // the challengeStake is used to notify user of how much they'll pass
  // also used with the allowance/balance
  // todo
  const challengeStake = new BigNumber(item.stake)
    .mul(registry.challengeStakeMultiplier)
    .div(10_000)

  console.log({ registry, challengeStake })
  // todo grab arbitrationCost. and youll display with an EthAmount thing with useNativeCurrency

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment
  }) => {
    pushWeb3Action(async ({ account, networkId }, signer) => {
      const gtcr = new ethers.Contract(registry.id, _gtcr, signer)
      const evidenceJSON = {
        title: title || 'Challenge Justification',
        description,
        ...evidenceAttachment
      }

      const enc = new TextEncoder()
      const fileData = enc.encode(JSON.stringify(evidenceJSON))
      /* eslint-enable prettier/prettier */
      const ipfsEvidencePath = getIPFSPath(
        await ipfsPublish('evidence.json', fileData)
      )

      // Request signature and submit.
      const tx = await gtcr.challengeItem(item.itemID, ipfsEvidencePath, {
        value: arbitrationCost
      })

      onCancel() // Hide the submission modal.

      // Subscribe for notifications
      if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!networkId)
        fetch(
          `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
          {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriberAddr: ethers.utils.getAddress(account),
              tcrAddr: ethers.utils.getAddress(registry.id),
              itemID: item.itemID,
              networkID: networkId
            })
          }
        )
          .then(() => setUserSubscribed(true))
          .catch(err => {
            console.error('Failed to subscribe for notifications.', err)
          })
      return {
        tx,
        actionMessage: `Challenging ${(itemName && itemName.toLowerCase()) ||
          'item'} ${
          statusCode === STATUS_CODE.SUBMITTED ? 'submission' : 'removal'
        }`
      }
    })
  }

  const EVIDENCE_FORM_ID = 'challengeEvidenceForm'
  console.log({ arbitrationCost })
  if (!arbitrationCost)
    return (
      <StyledModal title="Submit Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      footer={[
        <Button key="back" onClick={onCancel}>
          Back
        </Button>,
        <Button
          key="challengeSubmit"
          type="primary"
          form={EVIDENCE_FORM_ID}
          htmlType="submit"
        >
          Challenge
        </Button>
      ]}
      {...rest}
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
      <Typography.Paragraph>
        Explain to jurors why do you think this{' '}
        {statusCode === STATUS_CODE.SUBMITTED
          ? 'submission '
          : 'removal request '}
        should be rejected:
      </Typography.Paragraph>
      <EvidenceForm onSubmit={challengeRequest} formID={EVIDENCE_FORM_ID} />
      <Typography.Paragraph>
        To challenge a{' '}
        {statusCode === STATUS_CODE.SUBMITTED
          ? 'submission'
          : 'removal request'}
        , a deposit is required. This value will be awarded to the party that
        wins the dispute.
      </Typography.Paragraph>
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount decimals={3} amount={arbitrationCost.toString()} />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

ChallengeModal.propTypes = {
  item: itemPropTypes,
  itemName: PropTypes.string,
  fileURI: PropTypes.string,
  statusCode: PropTypes.oneOf(Object.values(STATUS_CODE))
}

ChallengeModal.defaultProps = {
  item: null,
  itemName: 'item',
  fileURI: '',
  statusCode: STATUS_CODE.REJECTED
}

export default ChallengeModal
