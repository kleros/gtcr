import React, { useContext, useCallback } from 'react'
import {
  Spin,
  Modal,
  Button,
  Form,
  Tooltip,
  Icon,
  Typography,
  Descriptions,
  Alert
} from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { WalletContext } from '../../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import { gtcrEncode } from '../../../utils/encoder'
import InputSelector from '../../../components/input-selector.js'
import { withFormik } from 'formik'
import itemTypes, { typeDefaultValues } from '../../../utils/item-types.js'
import ETHAmount from '../../../components/eth-amount.js'
import BNPropType from '../../../prop-types/bn'
import useFactory from '../../../hooks/factory'
import { TourContext } from '../../../bootstrap/tour-context'
import { capitalizeFirstLetter, getArticleFor } from '../../../utils/string'

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
`

const SUBMISSION_FORM_ID = 'submitItemForm'

const _SubmissionForm = ({
  columns,
  handleSubmit,
  setFieldValue,
  disabledFields,
  values,
  errors,
  touched
}) => (
  <Form onSubmit={handleSubmit} id={SUBMISSION_FORM_ID}>
    {columns &&
      columns.length > 0 &&
      columns.map((column, index) => (
        <InputSelector
          type={column.type}
          name={`${column.label}`}
          allowedFileTypes={column.allowedFileTypes}
          key={index}
          values={values}
          error={errors[column.label]}
          label={
            <span>
              {column.label}&nbsp;
              <Tooltip title={column.description}>
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          setFieldValue={setFieldValue}
          disabled={disabledFields && disabledFields[index]}
          touched={touched[column.label]}
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
  handleSubmit: PropTypes.func.isRequired,
  disabledFields: PropTypes.arrayOf(PropTypes.bool),
  values: PropTypes.shape({}),
  errors: PropTypes.shape({}).isRequired,
  touched: PropTypes.shape({}).isRequired
}

_SubmissionForm.defaultProps = {
  disabledFields: null,
  values: {}
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
  handleSubmit: (values, { props: { postSubmit, columns }, resetForm }) => {
    postSubmit(values, columns, resetForm)
  },
  validate: async (values, { columns, deployedWithFactory }) => {
    const errors = (
      await Promise.all(
        columns
          .filter(({ type }) => type === itemTypes.GTCR_ADDRESS)
          .map(async ({ label }) => ({
            isEmpty: !values[label],
            wasDeployedWithFactory:
              !!values[label] && (await deployedWithFactory(values[label])),
            label: label
          }))
      )
    )
      .filter(res => !res.wasDeployedWithFactory || res.isEmpty)
      .reduce(
        (acc, curr) => ({
          ...acc,
          [curr.label]: curr.isEmpty
            ? `Enter a list address to proceed.`
            : `This address was not deployed with the list creator.`
        }),
        {}
      )
    if (Object.keys(errors).length > 0) throw errors
  }
})(_SubmissionForm)

const SubmitModal = props => {
  const {
    onCancel,
    initialValues,
    submissionDeposit,
    tcrAddress,
    metaEvidence,
    disabledFields
  } = props
  const { pushWeb3Action } = useContext(WalletContext)
  const { deployedWithFactory } = useFactory()
  const { setUserSubscribed } = useContext(TourContext)

  const { fileURI, metadata } = metaEvidence || {}
  const { itemName, columns, tcrTitle } = metadata || {}

  const postSubmit = useCallback(
    (values, columns, resetForm) => {
      pushWeb3Action(async ({ account, networkId }, signer) => {
        const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
        const encodedParams = gtcrEncode({ columns, values })

        // Request signature and submit.
        const tx = await gtcr.addItem(encodedParams, {
          value: submissionDeposit
        })

        onCancel() // Hide the submission modal.
        resetForm({})
        return {
          tx,
          actionMessage: `Submitting ${(itemName && itemName.toLowerCase()) ||
            'item'}`,
          onTxMined: () => {
            // Subscribe for notifications
            if (!process.env.REACT_APP_NOTIFICATIONS_API_URL || networkId)
              return
            const itemID = ethers.utils.solidityKeccak256(
              ['bytes'],
              [encodedParams]
            )
            fetch(
              `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
              {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriberAddr: ethers.utils.getAddress(account),
                  tcrAddr: ethers.utils.getAddress(tcrAddress),
                  itemID,
                  networkID: networkId
                })
              }
            )
              .then(() => setUserSubscribed(true))
              .catch(err => {
                console.error('Failed to subscribe for notifications.', err)
              })
          }
        }
      })
    },
    [
      itemName,
      onCancel,
      pushWeb3Action,
      setUserSubscribed,
      submissionDeposit,
      tcrAddress
    ]
  )

  if (!metaEvidence || !submissionDeposit)
    return (
      <StyledModal
        title="Submit Item"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>
        ]}
        {...props}
      >
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      title={`Submit ${(itemName && capitalizeFirstLetter(itemName)) ||
        'Item'}`}
      footer={[
        <Button key="back" onClick={onCancel}>
          Back
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
      <Typography.Paragraph>
        Submit{' '}
        {itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'}{' '}
        to {tcrTitle || 'this list'} so other users can find it.
      </Typography.Paragraph>
      <SubmissionForm
        columns={columns}
        postSubmit={postSubmit}
        initialValues={initialValues}
        disabledFields={disabledFields}
        deployedWithFactory={deployedWithFactory}
      />
      <Typography.Paragraph>
        Make sure your submission complies with the{' '}
        <a href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}>
          listing criteria
        </a>{' '}
        to avoid losing your deposit.
      </Typography.Paragraph>

      <StyledAlert
        message="Warning: Submissions cannot be edited. Double check your submission before proceeding to avoid losing your deposit."
        type="warning"
        showIcon
      />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item
          label={
            <span>
              Total Deposit Required
              <Tooltip title="A deposit is required to submit. This value reimbursed at the end of the challenge period or, if there is a dispute, be awarded to the party that wins.">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          <ETHAmount
            decimals={3}
            amount={submissionDeposit.toString()}
            displayUnit
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

SubmitModal.propTypes = {
  onCancel: PropTypes.func.isRequired,
  initialValues: PropTypes.arrayOf(PropTypes.any),
  submissionDeposit: BNPropType,
  tcrAddress: PropTypes.string.isRequired,
  metaEvidence: PropTypes.shape({
    metadata: PropTypes.shape({
      itemName: PropTypes.string,
      columns: PropTypes.arrayOf(PropTypes.any),
      isTCRofTCRs: PropTypes.bool
    }).isRequired,
    fileURI: PropTypes.string
  }).isRequired,
  disabledFields: PropTypes.arrayOf(PropTypes.bool)
}

SubmitModal.defaultProps = {
  initialValues: null,
  disabledFields: null,
  submissionDeposit: null
}

export default SubmitModal
