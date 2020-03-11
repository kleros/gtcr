import React, { useContext } from 'react'
import { Modal, Typography, Button } from 'antd'
import { ethers } from 'ethers'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import { WalletContext } from '../../../bootstrap/wallet-context'
import itemPropTypes from '../../../prop-types/item'
import EvidenceForm from '../../../components/evidence-form.js'
import Archon from '@kleros/archon'
import ipfsPublish from '../../../utils/ipfs-publish.js'

const EvidenceModal = ({ item, ...rest }) => {
  // Get contract data.
  const { tcrAddress } = useContext(TCRViewContext)
  const { pushWeb3Action } = useContext(WalletContext)

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
        /* eslint-disable prettier/prettier */
        const fileMultihash = Archon.utils.multihashFile(
          evidenceJSON,
          0x1B
        )
        /* eslint-enable prettier/prettier */
        const ipfsEvidenceObject = await ipfsPublish(fileMultihash, fileData)
        const ipfsEvidencePath = `/ipfs/${ipfsEvidenceObject[1].hash +
          ipfsEvidenceObject[0].path}`

        // Request signature and submit.
        const tx = await gtcr.submitEvidence(item.ID, ipfsEvidencePath)

        rest.onCancel() // Hide the submission modal.
        return {
          tx,
          actionMessage: 'Submitting evidence',
          onTxMined: () => {
            // Subscribe for notifications
            if (!process.env.REACT_APP_NOTIFICATIONS_API_URL) return
            fetch(
              `${process.env.REACT_APP_NOTIFICATIONS_API_URL +
                networkId}/api/subscribe`,
              {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriberAddr: ethers.utils.getAddress(account),
                  tcrAddr: tcrAddress,
                  itemID: item.ID,
                  networkID: networkId
                })
              }
            )
          }
        }
      } catch (err) {
        console.error('Error submitting evidence:', err)
      }
    })
  }

  const EVIDENCE_FORM_ID = 'submitEvidenceForm'

  return (
    <Modal
      footer={[
        <Button key="back" onClick={rest.onCancel}>
          Return
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
    </Modal>
  )
}

EvidenceModal.propTypes = {
  item: itemPropTypes
}

EvidenceModal.defaultProps = {
  item: null
}

export default EvidenceModal
