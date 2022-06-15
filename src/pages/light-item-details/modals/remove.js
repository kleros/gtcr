import React, { useContext, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  Modal,
  Descriptions,
  Typography,
  Divider,
  Spin,
  Button,
  Alert
} from 'antd'
import { ethers } from 'ethers'
import styled from 'styled-components/macro'
import humanizeDuration from 'humanize-duration'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import ETHAmount from 'components/eth-amount'
import EvidenceForm from 'components/evidence-form'
import { WalletContext } from 'contexts/wallet-context'
import itemPropTypes from 'prop-types/item'
import ipfsPublish from 'utils/helpers/ipfs-publish'
import { TourContext } from 'contexts/tour-context'
import useNativeCurrency from 'hooks/native-currency'

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

const StyledAlert = styled(Alert)`
  margin-bottom: 12px;
  text-transform: initial;
`

const RemoveModal = ({ item, itemName = 'item', fileURI, ...rest }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const {
    tcrAddress,
    metaEvidence,
    regData: { removalDeposit, challengePeriodDuration }
  } = useContext(LightTCRViewContext)
  const nativeCurrency = useNativeCurrency()

  const { metadata } = metaEvidence || {}
  const { requireRemovalEvidence } = metadata || {}

  const removeItem = useCallback(
    ({ title, description, evidenceAttachment }) =>
      pushWeb3Action(async ({ account, networkId }, signer) => {
        const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
        let ipfsEvidencePath = ''
        if (metadata && requireRemovalEvidence) {
          const evidenceJSON = {
            title: title || 'Removal Justification',
            description,
            ...evidenceAttachment
          }

          const enc = new TextEncoder()
          const fileData = enc.encode(JSON.stringify(evidenceJSON))
          const ipfsEvidenceObject = await ipfsPublish(
            'evidence.json',
            fileData
          )
          ipfsEvidencePath = `/ipfs/${ipfsEvidenceObject[1].hash +
            ipfsEvidenceObject[0].path}`
        }

        // Request signature and send removal request.
        const tx = await gtcr.removeItem(item.ID, ipfsEvidencePath, {
          value: removalDeposit
        })

        rest.onCancel() // Hide the modal.

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
                itemID: item.ID,
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
          actionMessage: `Requesting ${(itemName && itemName.toLowerCase()) ||
            'item'} removal`
        }
      }),
    [
      item.ID,
      itemName,
      metadata,
      pushWeb3Action,
      removalDeposit,
      requireRemovalEvidence,
      rest,
      setUserSubscribed,
      tcrAddress
    ]
  )

  if (!removalDeposit)
    return (
      <StyledModal title="Remove Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  const EVIDENCE_FORM_ID = 'removeEvidenceForm'

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
          onClick={metadata && !requireRemovalEvidence ? removeItem : null}
        >
          Send
        </Button>
      ]}
      {...rest}
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
      {metadata && requireRemovalEvidence && (
        <Typography.Paragraph>
          Explain to jurors why do you think this item should be removed.
        </Typography.Paragraph>
      )}
      {metadata && requireRemovalEvidence && (
        <EvidenceForm onSubmit={removeItem} formID={EVIDENCE_FORM_ID} />
      )}
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if the removal is accepted. ${challengePeriodDuration &&
          `The challenge period lasts ${humanizeDuration(
            `${challengePeriodDuration.toNumber() * 1000}.`
          )}`}.`}
        type="info"
        showIcon
      />
      <Divider />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount
            decimals={3}
            amount={removalDeposit.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

RemoveModal.propTypes = {
  item: itemPropTypes,
  itemName: PropTypes.string,
  fileURI: PropTypes.string
}

RemoveModal.defaultProps = {
  item: null,
  itemName: 'item',
  fileURI: ''
}

export default RemoveModal
