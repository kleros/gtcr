import React, { useContext } from 'react'
import PropTypes from 'prop-types'
import { Modal, Descriptions, Typography } from 'antd'
import { ethers } from 'ethers'
import { abi as _gtcr } from '../../../assets/contracts/GTCRMock.json'
import { STATUS_CODE } from '../../../utils/item-status'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import ETHAmount from '../../../components/eth-amount'
import { WalletContext } from '../../../bootstrap/wallet-context'
import itemPropTypes from '../../../utils/item-prop-types'
import EvidenceForm from '../../../components/evidence-form.js'

const ChallengeRequestModal = ({
  item,
  itemName,
  statusCode,
  fileURI,
  ...rest
}) => {
  // Get contract data.
  const { challengeDeposit, tcrAddress } = useContext(TCRViewContext)
  const { pushWeb3Action } = useContext(WalletContext)

  const challengeRequest = () => {
    pushWeb3Action(async (_, signer) => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)

      // Request signature and submit.
      const tx = await gtcr.challengeRequest(item.ID, {
        value: challengeDeposit
      })

      rest.onCancel() // Hide the submission modal.
      return {
        tx,
        actionMessage: `Challenging ${itemName || 'item'} ${
          statusCode === STATUS_CODE.SUBMITTED ? 'submission' : 'removal'
        }`
      }
    })
  }

  return (
    <Modal {...rest} onOk={challengeRequest}>
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
      <Typography.Paragraph>
        Explain to jurors why do you think this{' '}
        {statusCode === STATUS_CODE.SUBMITTED
          ? 'submission '
          : 'removal request '}
        should be denied.
      </Typography.Paragraph>
      <EvidenceForm
        evidenceName={`${itemName || 'item'} ${
          statusCode === STATUS_CODE.SUBMITTED
            ? 'submission '
            : 'removal request '
        } challenge`}
      />
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
    </Modal>
  )
}

ChallengeRequestModal.propTypes = {
  item: itemPropTypes,
  itemName: PropTypes.string,
  fileURI: PropTypes.string,
  statusCode: PropTypes.oneOf(Object.values(STATUS_CODE))
}

ChallengeRequestModal.defaultProps = {
  item: null,
  itemName: 'item',
  fileURI: '',
  statusCode: STATUS_CODE.REJECTED
}

export default ChallengeRequestModal
