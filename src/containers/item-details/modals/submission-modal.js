import React, { useContext } from 'react'
import {
  Spin,
  Modal,
  Button,
  Form,
  Tooltip,
  Icon,
  Typography,
  Descriptions
} from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import { abi as _gtcr } from '../../../assets/contracts/GTCRMock.json'
import { WalletContext } from '../../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import { gtcrEncode } from '../../../utils/encoder'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import InputSelector from '../../../components/input-selector.js'
import { withFormik } from 'formik'
import { typeDefaultValues } from '../../../utils/item-types.js'
import ETHAmount from '../../../components/eth-amount.js'

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const SUBMISSION_FORM_ID = 'submitItemForm'

// TODO: Check if TCR requires evidence when submitting and if so, require it.
// TODO: Add information on deposit costs.
const _SubmissionForm = ({ columns, handleSubmit, setFieldValue }) => (
  <Form onSubmit={handleSubmit} id={SUBMISSION_FORM_ID}>
    {columns &&
      columns.length > 0 &&
      columns.map((column, index) => (
        <InputSelector
          type={column.type}
          name={column.label}
          key={index}
          label={
            <span>
              {column.label}&nbsp;
              <Tooltip title={column.description}>
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          setFieldValue={setFieldValue}
        />
      ))}
  </Form>
)

_SubmissionForm.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired
    })
  ).isRequired,
  setFieldValue: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired
}

const SubmissionForm = withFormik({
  mapPropsToValues: ({ columns, initialValues }) =>
    columns.reduce(
      (acc, curr, i) => ({
        ...acc,
        [curr.label]: initialValues
          ? initialValues[i]
          : typeDefaultValues[curr.type]
      }),
      {}
    ),
  handleSubmit: (values, { props: { postSubmit, columns } }) => {
    postSubmit(values, columns)
  }
})(_SubmissionForm)

const SubmissionModal = props => {
  const { onCancel, initialValues } = props
  const { pushWeb3Action } = useContext(WalletContext)
  const { requestDeposit, tcrAddress, metaEvidence } = useContext(
    TCRViewContext
  )

  if (!metaEvidence)
    return (
      <Modal
        title="Submit Item"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>
        ]}
        {...props}
      >
        <StyledSpin />
      </Modal>
    )

  const { fileURI, itemName, columns } = metaEvidence

  const postSubmit = (values, columns) => {
    pushWeb3Action(async (_, signer) => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
      const encodedParams = gtcrEncode({ columns, values })

      // Request signature and submit.
      const tx = await gtcr.addItem(encodedParams, {
        value: requestDeposit
      })

      onCancel() // Hide the submission modal.
      return {
        tx,
        actionMessage: `Submitting ${itemName || 'item'}`
      }
    })
  }

  return (
    <Modal
      title={`Submit ${itemName || 'Item'}`}
      footer={[
        <Button key="back" onClick={onCancel}>
          Return
        </Button>,
        <Button
          key="challengeSubmit"
          type="primary"
          form={SUBMISSION_FORM_ID}
          htmlType="submit"
        >
          Submit
        </Button>
      ]}
      {...props}
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
      <SubmissionForm
        columns={columns}
        postSubmit={postSubmit}
        initialValues={initialValues}
      />
      <Typography.Paragraph>
        A deposit is required to submit. This value reimbursed at the end of the
        challenge period or, if there is a dispute, be awarded to the party that
        wins.
      </Typography.Paragraph>
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount
            decimals={3}
            amount={requestDeposit.toString()}
            displayUnit
          />
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  )
}

SubmissionModal.propTypes = {
  onCancel: PropTypes.func.isRequired,
  initialValues: PropTypes.arrayOf(PropTypes.any)
}

SubmissionModal.defaultProps = {
  initialValues: null
}

export default SubmissionModal
