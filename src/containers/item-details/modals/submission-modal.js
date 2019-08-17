import React, { useContext } from 'react'
import { Spin, Modal, Button, Form, Tooltip, Icon } from 'antd'
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

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const StyledModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`

// TODO: Check if TCR requires evidence when submitting and if so, require it.
// TODO: Add information on deposit costs.
const _SubmissionForm = ({
  columns,
  handleSubmit,
  onCancel,
  setFieldValue
}) => (
  <Form onSubmit={handleSubmit}>
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
    <StyledModalFooter>
      <Button key="back" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        key="submit"
        type="primary"
        htmlType="submit"
        style={{ marginLeft: '8px' }}
      >
        Submit
      </Button>
    </StyledModalFooter>
  </Form>
)

_SubmissionForm.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired
    })
  ).isRequired,
  onCancel: PropTypes.func.isRequired,
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
        actionMessage: `Submitting ${metaEvidence.itemName || 'item'}`
      }
    })
  }

  return (
    <Modal
      title={`Submit ${metaEvidence.itemName || 'Item'}`}
      footer={null}
      {...onCancel}
      {...props}
    >
      <SubmissionForm
        columns={metaEvidence.columns}
        postSubmit={postSubmit}
        onCancel={onCancel}
        initialValues={initialValues}
      />
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
