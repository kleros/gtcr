import React, { useContext } from 'react'
import { Typography, Button } from 'antd'
import { ethers } from 'ethers'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import itemPropTypes from 'prop-types/item'
import EvidenceForm from 'components/evidence-form.js'
import ipfsPublish from 'utils/ipfs-publish.js'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { TourContext } from 'contexts/tour-context'
import { StyledModal } from './challenge'

const EvidenceModal = ({ item, ...rest }) => {
  // Get contract data.
  const { tcrAddress } = useContext(LightTCRViewContext)
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)

  const submitEvidence = async ({ title, description, evidenceAttachment }) => {
    pushWeb3Action(async ({ account, networkId }, signer) => {
      try {
        const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
        const evidenceJSON = {
          title: title,
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
        const tx = await gtcr.submitEvidence(item.itemID, ipfsEvidencePath)

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
                tcrAddr: tcrAddress,
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
          actionMessage: 'Submitting evidence',
          onTxMined: () => {}
        }
      } catch (err) {
        console.error('Error submitting evidence:', err)
      }
    })
  }

  const EVIDENCE_FORM_ID = 'submitEvidenceForm'

  return (
    <StyledModal
      footer={[
        <Button key="back" onClick={rest.onCancel}>
          Back
        </Button>,
        <Button
          key="submitEvidence"
          type="primary"
          form={EVIDENCE_FORM_ID}
          htmlType="submit"
        >
          Submit
        </Button>
      ]}
      {...rest}
    >
      <Typography.Title level={4}>Evidence Submission</Typography.Title>
      <EvidenceForm
        onSubmit={submitEvidence}
        formID={EVIDENCE_FORM_ID}
        detailed
      />
    </StyledModal>
  )
}

EvidenceModal.propTypes = {
  item: itemPropTypes
}

EvidenceModal.defaultProps = {
  item: null
}

export default EvidenceModal
