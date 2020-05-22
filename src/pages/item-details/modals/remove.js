import React, { useContext, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Modal, Descriptions, Typography, Divider, Spin, Button } from 'antd'
import { ethers } from 'ethers'
import Archon from '@kleros/archon'
import styled from 'styled-components/macro'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import ETHAmount from '../../../components/eth-amount'
import EvidenceForm from '../../../components/evidence-form'
import { WalletContext } from '../../../bootstrap/wallet-context'
import itemPropTypes from '../../../prop-types/item'
import ipfsPublish from '../../../utils/ipfs-publish'

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

const RemoveModal = ({ item, itemName = 'item', fileURI, ...rest }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const { removalDeposit, tcrAddress, metaEvidence } = useContext(
    TCRViewContext
  )

  const { metadata } = metaEvidence || {}

  const removeItem = useCallback(
    ({ title, description, evidenceAttachment }) =>
      pushWeb3Action(async ({ account, networkId }, signer) => {
        const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
        let ipfsEvidencePath = ''
        if (metadata.requireRemovalEvidence) {
          const evidenceJSON = {
            title: title || 'Removal Justification',
            description,
            ...evidenceAttachment
          }

          const enc = new TextEncoder()
          const fileData = enc.encode(JSON.stringify(evidenceJSON))

          // eslint-disable-next-line unicorn/number-literal-case
          const fileMultihash = Archon.utils.multihashFile(evidenceJSON, 0x1b)

          const ipfsEvidenceObject = await ipfsPublish(fileMultihash, fileData)
          ipfsEvidencePath = `/ipfs/${ipfsEvidenceObject[1].hash +
            ipfsEvidenceObject[0].path}`
        }

        // Request signature and send removal request.
        const tx = await gtcr.removeItem(item.ID, ipfsEvidencePath, {
          value: removalDeposit
        })

        rest.onCancel() // Hide the modal.
        return {
          tx,
          actionMessage: `Requesting ${(itemName && itemName.toLowerCase()) ||
            'item'} removal`,
          onTxMined: () => {
            // Subscribe for notifications
            if (!process.env.REACT_APP_NOTIFICATIONS_API_URL || !networkId)
              return
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
          }
        }
      }),
    [
      item.ID,
      itemName,
      metadata,
      pushWeb3Action,
      removalDeposit,
      rest,
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
          Return
        </Button>,
        <Button
          key="challengeSubmit"
          type="primary"
          form={EVIDENCE_FORM_ID}
          htmlType="submit"
          onClick={
            metadata && !metadata.requireRemovalEvidence ? removeItem : null
          }
        >
          Remove
        </Button>
      ]}
      {...rest}
    >
      <Typography.Title level={4}>
        See the&nbsp;
        <a
          href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Listing Criteria
        </a>
        .
      </Typography.Title>
      {metadata.requireRemovalEvidence && (
        <Typography.Paragraph>
          Explain to jurors why do you think this item should be removed.
        </Typography.Paragraph>
      )}
      {metadata.requireRemovalEvidence && (
        <EvidenceForm onSubmit={removeItem} formID={EVIDENCE_FORM_ID} />
      )}
      <Typography.Paragraph>
        To remove an item, a deposit is required. This value will be reimbursed
        after the challenge period if no one challenges the request.
      </Typography.Paragraph>
      <Divider />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount
            decimals={3}
            amount={removalDeposit.toString()}
            displayUnit
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
