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
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)

      const evidenceJSON = {
        title: title,
        description,
        ...evidenceAttachment
      }

      const enc = new TextEncoder()
      const fileData = enc.encode(JSON.stringify(evidenceJSON))

      /* eslint-enable prettier/prettier */
      const ipfsResult = await ipfsPublish('evidence.json', fileData)
      const ipfsEvidencePath = getIPFSPath(ipfsResult)

      // Request signature and submit.
      const tx = await gtcr.submitEvidence(item.itemID, ipfsEvidencePath)

      return {
        tx,
        actionMessage: 'Submitting evidence...',
        onTxMined: () => rest.onCancel()
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
