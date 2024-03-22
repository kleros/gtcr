import React, { useContext } from 'react'
import styled from 'styled-components'
import { Modal, Descriptions, Typography, Button, Spin } from 'antd'
import PropTypes from 'prop-types'
import { ethers } from 'ethers'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { STATUS_CODE, CONTRACT_STATUS } from 'utils/item-status'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import ETHAmount from 'components/eth-amount'
import { WalletContext } from 'contexts/wallet-context'
import itemPropTypes from 'prop-types/item'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish.js'
import { TourContext } from 'contexts/tour-context'
import { parseIpfs } from 'utils/ipfs-parse'

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

const ChallengeModal = ({ item, itemName, statusCode, fileURI, ...rest }) => {
  // Get contract data.
  const {
    submissionChallengeDeposit,
    removalChallengeDeposit,
    tcrAddress
  } = useContext(LightTCRViewContext)
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const challengeDeposit =
    item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
      ? submissionChallengeDeposit
      : removalChallengeDeposit

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment
  }) => {
    pushWeb3Action(async ({ account, networkId }, signer) => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
      const evidenceJSON = {
        title: title || 'Challenge Justification',
        description,
        ...evidenceAttachment
      }

      const enc = new TextEncoder()
      const fileData = enc.encode(JSON.stringify(evidenceJSON))
      /* eslint-enable prettier/prettier */
      const ipfsEvidenceObject = await ipfsPublish('evidence.json', fileData)
      const ipfsEvidencePath = `/ipfs/${ipfsEvidenceObject[1].hash +
        ipfsEvidenceObject[0].path}`

      // Request signature and submit.
      const tx = await gtcr.challengeRequest(item.itemID, ipfsEvidencePath, {
        value: challengeDeposit
      })

      rest.onCancel() // Hide the submission modal.

      // Subscribe for notifications
      if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!networkId)
        fetch(
          `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
          {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriberAddr: ethers.utils.getAddress(account),
              tcrAddr: ethers.utils.getAddress(tcrAddress),
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

  if (!challengeDeposit)
    return (
      <StyledModal title="Submit Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      footer={[
        <Button key="back" onClick={rest.onCancel}>
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
          <ETHAmount decimals={3} amount={challengeDeposit.toString()} />
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
