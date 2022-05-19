import React, { useContext, useCallback, useState } from 'react'
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
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { ethers } from 'ethers'
import { withFormik } from 'formik'
import humanizeDuration from 'humanize-duration'
import { WalletContext } from 'contexts/wallet-context'
import { ItemTypes, typeDefaultValues } from '@kleros/gtcr-encoder'
import InputSelector from 'components/input-selector.js'
import ETHAmount from 'components/eth-amount'
import BNPropType from 'prop-types/bn'
import useFactory from 'hooks/factory'
import { TourContext } from 'contexts/tour-context'
import { addPeriod, capitalizeFirstLetter, getArticleFor } from 'utils/string'
import useNativeCurrency from 'hooks/native-currency'
import ipfsPublish from 'utils/ipfs-publish'

const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

const StyledModal = styled(Modal)`
  text-transform: capitalize;
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const StyledAlert = styled(Alert)`
  margin-bottom: 12px;
  text-transform: initial;
`

const StyledParagraph = styled(Typography.Paragraph)`
  text-transform: none;
`

const SUBMISSION_FORM_ID = 'submitItemForm'

const _SubmissionForm = ({
  columns,
  handleSubmit,
  setFieldValue,
  disabledFields,
  values,
  errors,
  touched,
  status
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
          setFieldValue={setFieldValue}
          disabled={disabledFields && disabledFields[index]}
          touched={touched[column.label]}
          setFileToUpload={status.setFileToUpload}
          setFileAsUploaded={status.setFileAsUploaded}
          label={
            <span>
              {column.label}&nbsp;
              <Tooltip title={addPeriod(column.description)}>
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
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
  touched: PropTypes.shape({}).isRequired,
  status: PropTypes.shape({
    setFileToUpload: PropTypes.func.isRequired,
    setFileAsUploaded: PropTypes.func.isRequired
  }).isRequired
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
  mapPropsToStatus: props => ({
    setFileToUpload: props.setFileToUpload,
    setFileAsUploaded: props.setFileAsUploaded
  }),
  validate: async (
    values,
    { columns, deployedWithFactory, deployedWithLightFactory }
  ) => {
    const errors = (
      await Promise.all(
        columns
          .filter(({ type }) => type === ItemTypes.GTCR_ADDRESS)
          .map(async ({ label }) => ({
            isEmpty: !values[label],
            wasDeployedWithFactory:
              !!values[label] &&
              ((await deployedWithFactory(values[label])) ||
                (await deployedWithLightFactory(values[label]))),
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
    disabledFields,
    challengePeriodDuration
  } = props
  const nativeCurrency = useNativeCurrency()
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const { deployedWithFactory, deployedWithLightFactory } = useFactory()

  const { fileURI, metadata } = metaEvidence || {}
  const { itemName, columns, tcrTitle } = metadata || {}

  const postSubmit = useCallback(
    (values, columns, resetForm) => {
      pushWeb3Action(async ({ account, networkId }, signer) => {
        const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
        const enc = new TextEncoder()
        const fileData = enc.encode(JSON.stringify({ columns, values }))
        const ipfsEvidenceObject = await ipfsPublish('item.json', fileData)
        const ipfsEvidencePath = `/ipfs/${ipfsEvidenceObject[1].hash +
          ipfsEvidenceObject[0].path}`

        // Request signature and submit.
        const tx = await gtcr.addItem(ipfsEvidencePath, {
          value: submissionDeposit
        })

        onCancel() // Hide the submission modal.
        resetForm({})
        // Subscribe for notifications
        if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!networkId) {
          const itemID = ethers.utils.solidityKeccak256(
            ['string'],
            [ipfsEvidencePath]
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
        return {
          tx,
          actionMessage: `Submitting ${(itemName && itemName.toLowerCase()) ||
            'item'}`
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

  // To make sure user cannot press Submit while there are files uploading
  // submit will be blocked until there are no files uploading.
  const [loadingCounter, setLoadingCounter] = useState(0)
  const setFileToUpload = setUploading => {
    setUploading(true)
    setLoadingCounter(loadingCounter + 1)
  }
  const setFileAsUploaded = setUploading => {
    setUploading(false)
    setLoadingCounter(loadingCounter - 1)
  }

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
          loading={loadingCounter > 0}
        >
          Submit
        </Button>
      ]}
      {...props}
    >
      <StyledParagraph>
        Submit{' '}
        {itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'}{' '}
        to {tcrTitle || 'this list'} so other users can find it.
      </StyledParagraph>
      <SubmissionForm
        columns={columns}
        postSubmit={postSubmit}
        initialValues={initialValues}
        disabledFields={disabledFields}
        deployedWithFactory={deployedWithFactory}
        deployedWithLightFactory={deployedWithLightFactory}
        setFileToUpload={setFileToUpload}
        setFileAsUploaded={setFileAsUploaded}
      />
      <Typography.Paragraph>
        Make sure your submission complies with the{' '}
        <a
          href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          listing criteria
        </a>{' '}
        to avoid challenges.
      </Typography.Paragraph>
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if your submission is accepted. ${challengePeriodDuration &&
          `The challenge period lasts ${humanizeDuration(
            `${challengePeriodDuration.toNumber() * 1000}.`
          )}`}.`}
        type="info"
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
            displayUnit={` ${nativeCurrency}`}
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
  disabledFields: PropTypes.arrayOf(PropTypes.bool),
  challengePeriodDuration: BNPropType
}

SubmitModal.defaultProps = {
  initialValues: null,
  disabledFields: null,
  submissionDeposit: null,
  challengePeriodDuration: null
}

export default SubmitModal
