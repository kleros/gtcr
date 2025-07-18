import React, { useContext } from 'react'
import { Typography, Button } from 'antd'
import { ethers } from 'ethers'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { WalletContext } from 'contexts/wallet-context'
import itemPropTypes from 'prop-types/item'
import EvidenceForm from 'components/evidence-form.js'
import ipfsPublish from 'utils/ipfs-publish.js'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { StyledModal } from './challenge'

const EvidenceModal = ({ item, ...rest }) => {
  // Get contract data.
  const tcrAddress = item?.registry?.id
  const { pushWeb3Action } = useContext(WalletContext)

  const submitEvidence = async ({ title, description, evidenceAttachment }) => {
    pushWeb3Action(async (_, signer) => {
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
        const _tx = await gtcr.submitEvidence(item.itemID, ipfsEvidencePath)

        rest.onCancel() // Hide the submission modal.
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
