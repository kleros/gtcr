import React, { useEffect, useState, useCallback } from 'react'
import { Card, Icon, Tooltip, Form, Switch, Upload, message, Alert } from 'antd'
import { withFormik, Field } from 'formik'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import styled from 'styled-components/macro'
import CustomInput from '../../components/custom-input'
import itemTypes from '../../utils/item-types'
import ipfsPublish from '../../utils/ipfs-publish'
import { sanitize } from '../../utils/string'
import BaseDepositInput from '../../components/base-deposit-input'
import { useWeb3Context } from 'web3-react'
import useArbitrationCost from '../../hooks/arbitration-cost'
import useNetworkEnvVariable from '../../hooks/network-env'
import { useDebounce } from 'use-debounce/lib'
import { getAddress } from 'ethers/utils'
import KlerosParams from './kleros-params'

const StyledUpload = styled(Upload)`
  & > .ant-upload.ant-upload-select-picture-card {
    width: 100%;
  }
`

const StyledAlert = styled(Alert)`
  margin-bottom: 32px;
`

const UploadButton = ({ loading }) => (
  <div>
    <Icon type={loading ? 'loading' : 'plus'} />
    <div className="ant-upload-text">Upload</div>
  </div>
)

UploadButton.propTypes = {
  loading: PropTypes.bool
}

UploadButton.defaultProps = {
  loading: null
}

const TCRParams = ({
  handleSubmit,
  formId,
  errors,
  setFieldValue,
  touched,
  defaultArbLabel,
  defaultArbDataLabel,
  defaultGovernorLabel,
  ...rest
}) => {
  const { values, setTcrState } = rest
  const [uploading, setUploading] = useState({})
  const [advancedOptions, setAdvancedOptions] = useState()
  const { library, networkId } = useWeb3Context()
  const [debouncedArbitrator] = useDebounce(values.arbitratorAddress, 1000)
  const {
    arbitrator: klerosAddress,
    policy: policyAddress
  } = useNetworkEnvVariable('REACT_APP_KLEROS_ADDRESSES', networkId)
  const { arbitrationCost } = useArbitrationCost({
    address: values.arbitratorAddress,
    arbitratorExtraData: values.arbitratorExtraData,
    library
  })
  const setArbitratorExtraData = useCallback(
    val => setFieldValue('arbitratorExtraData', val),
    [setFieldValue]
  )

  let isKlerosArbitrator
  try {
    isKlerosArbitrator =
      getAddress(debouncedArbitrator) === getAddress(klerosAddress)
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    isKlerosArbitrator = false
  }

  useEffect(() => {
    setTcrState(previousState => ({
      ...previousState,
      ...values
    }))
  }, [values, setTcrState])

  const fileUploadStatusChange = useCallback(
    ({ file: { status }, file }) => {
      if (status === 'done') message.success(`File uploaded successfully.`)
      else if (status === 'error') message.error(`File upload failed.`)
      else if (status === 'uploading')
        if (file.type === 'image/png' || file.type === 'image/svg+xml')
          setUploading({ ...uploading, tcrLogo: true })
        else setUploading({ ...uploading, tcrPrimaryDocument: true })

      if (status === 'error' || status === 'done')
        if (file.type === 'image/png' || file.type === 'image/svg+xml')
          setUploading({ ...uploading, tcrLogo: false })
        else setUploading({ ...uploading, tcrPrimaryDocument: false })
    },
    [uploading]
  )

  const beforeImageUpload = useCallback(file => {
    const isPNGorJPEGorSVG =
      file.type === 'image/png' ||
      file.type === 'image/svg+xml' ||
      file.type === 'image/jpeg'
    if (!isPNGorJPEGorSVG) message.error('Please use PNG, JPEG or SVG.')

    const isLt2M = file.size / 1024 / 1024 < 2
    if (!isLt2M) message.error('Image must smaller than 2MB.')

    return isPNGorJPEGorSVG && isLt2M
  }, [])

  const beforeFileUpload = useCallback(file => {
    const isPDF = file.type === 'application/pdf'
    if (!isPDF) message.error('Please upload file as PDF.')

    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) message.error('File must smaller than 10MB.')

    return isPDF && isLt10M
  }, [])

  const customRequest = useCallback(
    fieldName => async ({ file, onSuccess, onError }) => {
      try {
        const data = await new Response(new Blob([file])).arrayBuffer()
        const ipfsFileObj = await ipfsPublish(sanitize(file.name), data)
        const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`

        setFieldValue(fieldName, fileURI)
        onSuccess('ok', `${process.env.REACT_APP_IPFS_GATEWAY}${fileURI}`)
      } catch (err) {
        console.error(err)
        onError(err)
      }
    },
    [setFieldValue]
  )

  return (
    <Card title="Choose the item columns and identifiers">
      <Form layout="vertical" id={formId} onSubmit={handleSubmit}>
        <CustomInput
          name="tcrTitle"
          placeholder="Red Socks"
          label={
            <span>
              Title&nbsp;
              <Tooltip title="This will be the title of your list. Try to keep it as short as possible for increased compatibility with mobile devices, Twitter bots and push notifications. For example: Red Socks.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          error={errors.tcrTitle}
          touched={touched.tcrTitle}
          hasFeedback
          {...rest}
        />
        <CustomInput
          name="tcrDescription"
          placeholder="A list of red socks"
          hasFeedback
          error={errors.tcrDescription}
          touched={touched.tcrDescription}
          label={
            <span>
              Description&nbsp;
              <Tooltip title="Enter a short sentence to describe the type of item that will be displayed in the list and what the listing criteria are. For example: Images red socks from various manufacturers.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="itemName"
          placeholder="Token"
          hasFeedback
          error={errors.itemName}
          touched={touched.itemName}
          label={
            <span>
              Item Name&nbsp;
              <Tooltip
                title={`Enter a noun that describes the item that will be listed. This will replace the word "item" in the list interface and notifications. For example: if you set this to the word "Socks", on the list interface you will see buttons such as "Submit Socks" and "Challenge Socks".`}
              >
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <BaseDepositInput
          name="submissionBaseDeposit"
          error={errors.submissionBaseDeposit}
          touched={touched.submissionBaseDeposit}
          arbitrationCost={arbitrationCost}
          label={
            <span>
              Submission Deposit&nbsp;
              <Tooltip title="This is the deposit required to submit an item to the list and also the amount awarded to successful challengers. If the value is too low, challengers may not have enough incentive to look for flaws in the submissions and bad ones could make it through. If it is too high, submitters may not have enough incentive to send items which may result in an empty list.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <BaseDepositInput
          name="removalBaseDeposit"
          error={errors.removalBaseDeposit}
          touched={touched.removalBaseDeposit}
          arbitrationCost={arbitrationCost}
          label={
            <span>
              Removal Deposit&nbsp;
              <Tooltip title="This is the deposit required to remove an item and also the amount awarded to successful challengers. If the value is too low, people will not have enough incentive to look for flaws in removal requests and compliant items could be removed from the list. If it is too high, people will be afraid to remove items so a non compliant submission could stay longer than it should.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <BaseDepositInput
          name="submissionChallengeBaseDeposit"
          error={errors.submissionChallengeBaseDeposit}
          touched={touched.submissionChallengeBaseDeposit}
          arbitrationCost={arbitrationCost}
          label={
            <span>
              Challenge Submission Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a submission.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <BaseDepositInput
          name="removalChallengeBaseDeposit"
          error={errors.removalChallengeBaseDeposit}
          touched={touched.removalChallengeBaseDeposit}
          arbitrationCost={arbitrationCost}
          label={
            <span>
              Challenge Removal Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a removal request.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="challengePeriodDuration"
          placeholder="5"
          addonAfter="Hours"
          error={errors.challengePeriodDuration}
          touched={touched.challengePeriodDuration}
          type={itemTypes.NUMBER}
          step={1}
          label={
            <span>
              Challenge Period Duration (hours) &nbsp;
              <Tooltip title="The length of the challenge period in hours.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <div style={{ marginBottom: '26px' }}>
          <div className="ant-col ant-form-item-label">
            <label htmlFor="primary-document">
              <span>Primary Document&nbsp;</span>
              <Tooltip title="The list primary document defines the acceptance criteria that jurors and prosecutors will use to evaluate submissions. Use the PDF file format.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </label>
            <br />
            Click{' '}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://ipfs.kleros.io/ipfs/QmbqgkZoGu7jJ8nTqee4NypEhK7YVBEJJmPJbJxz8Bx8nY/t2cr-primary-doc.pdf"
            >
              here
            </a>{' '}
            to view an example of a primary document.
          </div>
          <StyledUpload
            name="primary-document"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={customRequest('tcrPrimaryDocument')}
            beforeUpload={beforeFileUpload}
            onChange={fileUploadStatusChange}
          >
            {values.tcrPrimaryDocument ? (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`${process.env.REACT_APP_IPFS_GATEWAY}${values.tcrPrimaryDocument}`}
              >
                <Icon type="file-pdf" style={{ fontSize: '30px' }} />
              </a>
            ) : (
              <UploadButton loading={uploading.tcrPrimaryDocument} />
            )}
          </StyledUpload>
        </div>
        <div style={{ marginBottom: '26px' }}>
          <div className="ant-col ant-form-item-label">
            <label htmlFor="tcr-logo">
              <span>List Logo&nbsp;</span>
              <Tooltip title="The logo should be a 1:1 aspect ratio image with transparent background in SVG or PNG.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </label>
          </div>
          <StyledUpload
            name="primary-document"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={customRequest('tcrLogo')}
            beforeUpload={beforeImageUpload}
            onChange={fileUploadStatusChange}
          >
            {values.tcrLogo ? (
              <img
                src={`${process.env.REACT_APP_IPFS_GATEWAY}${values.tcrLogo}`}
                style={{ height: '70px', objectFit: 'contain' }}
                alt="avatar"
              />
            ) : (
              <UploadButton loading={uploading.tcrLogo} />
            )}
          </StyledUpload>
        </div>
        <Form.Item
          label="Advanced options"
          style={{ marginBottom: '12px', display: 'flex' }}
        >
          <Switch
            onChange={() => setAdvancedOptions(toggle => !toggle)}
            style={{ marginLeft: '8px' }}
          />
        </Form.Item>
        <CustomInput
          name="governorAddress"
          placeholder="0x7331deadbeef..."
          hasFeedback
          error={errors.governorAddress}
          touched={touched.governorAddress}
          label={
            <span>
              Governor&nbsp;
              <Tooltip
                title={`The address of the governor to use for this list. It can update parameters such as the challenge period duration, deposits, primary document and the TCR governor. By default it is set to ${defaultGovernorLabel}`}
              >
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        {advancedOptions && (
          <>
            <CustomInput
              name="arbitratorAddress"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.arbitratorAddress}
              touched={touched.arbitratorAddress}
              label={
                <span>
                  Arbitrator&nbsp;
                  <Tooltip
                    title={`This is the contract address of the arbitrator that will resolve the disputes occurring in this list. By default it is set to ${defaultArbLabel}, but you could use any other arbitrator complying with the ERC 792 standard.`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            {!isKlerosArbitrator && policyAddress ? (
              <CustomInput
                name="arbitratorExtraData"
                placeholder="0x7331deadbeef..."
                hasFeedback
                error={errors.arbitratorExtraData}
                touched={touched.arbitratorExtraData}
                label={
                  <span>
                    Arbitrator Extra Data&nbsp;
                    <Tooltip
                      title={`The extra data for the arbitrator. See ERC 792 for more information. Default: ${defaultArbDataLabel}`}
                    >
                      <Icon type="question-circle-o" />
                    </Tooltip>
                  </span>
                }
                {...rest}
              />
            ) : (
              <KlerosParams
                arbitratorExtraData={values.arbitratorExtraData}
                klerosAddress={debouncedArbitrator}
                policyAddress={policyAddress}
                setArbitratorExtraData={setArbitratorExtraData}
              />
            )}
            <StyledAlert
              message="To appeal, in addition to paying enough fees to cover the payment to the jurors in case the appeal is lost, parties must also pay an additional stake. The stake of the side that ultimately loses the dispute is used as the reward given to the appeal fee contributors that funded the side that ultimately wins the dispute. This amount is calculated proportionally to the total juror fees required for appeal using the multipliers below, given in basis points. For example, a multiplier of 1000 will result in the stake being 10% of the total juror fees."
              type="info"
              showIcon
            />
            <StyledAlert
              message="The total cost to fully fund one side of an appeal is: Total Appeal Cost=Total Juror Fees+Total Juror Fees*Stake Multiplier/10000"
              type="info"
              showIcon
            />
            <CustomInput
              name="sharedStakeMultiplier"
              placeholder="10000"
              error={errors.sharedStakeMultiplier}
              touched={touched.sharedStakeMultiplier}
              type={itemTypes.NUMBER}
              label={
                <span>
                  Shared stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the stake both parties must pay to fully fund their side of an appeal when there isn't a winner or looser (e.g. when the arbitrator refused to rule). Given in basis points.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="winnerStakeMultiplier"
              placeholder="10000"
              error={errors.winnerStakeMultiplier}
              touched={touched.winnerStakeMultiplier}
              type={itemTypes.NUMBER}
              label={
                <span>
                  Winner stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the fee stake the winner of a round must pay to fully fund his side of an appeal. Given in basis points.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="looserStakeMultiplier"
              placeholder="20000"
              error={errors.looserStakeMultiplier}
              touched={touched.looserStakeMultiplier}
              type={itemTypes.NUMBER}
              label={
                <span>
                  Loser stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the fee stake the loser of a round must pay to fully fund his side of an appeal. Given in basis points.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <Field name="requireRemovalEvidence">
              {({ field }) => (
                <Form.Item
                  label={
                    <span>
                      Require evidence for removing items&nbsp;
                      <Tooltip
                        title={`The first question that arises when someone requests to remove an item is "why do you want to remove it?". Leaving this switched on will prompt the requester to also justify it. Without a justification it becomes risky to challenge the removal request so, in general this should be left turned on.`}
                      >
                        <Icon type="question-circle-o" />
                      </Tooltip>
                    </span>
                  }
                  style={{ marginBottom: '12px', display: 'flex' }}
                >
                  <Switch
                    onChange={value =>
                      setFieldValue('requireRemovalEvidence', value)
                    }
                    style={{ marginLeft: '8px' }}
                    checked={field.value}
                  />
                </Form.Item>
              )}
            </Field>
          </>
        )}
      </Form>
    </Card>
  )
}

TCRParams.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  setFieldValue: PropTypes.func.isRequired,
  formId: PropTypes.string.isRequired,
  errors: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string))
    ])
  ).isRequired,
  touched: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.arrayOf(PropTypes.objectOf(PropTypes.bool))
    ])
  ).isRequired,
  defaultArbLabel: PropTypes.string.isRequired,
  defaultArbDataLabel: PropTypes.string.isRequired,
  defaultGovernorLabel: PropTypes.string.isRequired
}

const validationSchema = yup.object().shape({
  tcrTitle: yup
    .string()
    .required('A title is required.')
    .max(30, 'Title must be less than 60 characters long.'),
  tcrDescription: yup
    .string()
    .required('A description is required.')
    .max(255, 'Description must be less than 255 characters long.'),
  arbitratorAddress: yup
    .string()
    .required('An arbitrator address is required.')
    .max(160, 'Ethereum addresses are 42 characters long.'),
  arbitratorExtraData: yup
    .string()
    .required('The arbitrator extra data is required.'),
  governorAddress: yup
    .string()
    .required('A governor address is required.')
    .max(160, 'Ethereum addresses are 42 characters long.'),
  itemName: yup
    .string()
    .required('An item name is required.')
    .max(60, 'The item name must be less than 20 characters long.'),
  submissionBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  removalBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  submissionChallengeBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  removalChallengeBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  challengePeriodDuration: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  tcrPrimaryDocument: yup.string().required('A primary document is required.'),
  tcrLogo: yup.string().required('A logo is required.'),
  sharedStakeMultiplier: yup
    .number()
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  winnerStakeMultiplier: yup
    .number()
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  looserStakeMultiplier: yup
    .number()
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required')
})

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => {
    const values = { ...tcrState }
    delete values.transactions
    return values
  },
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  }
})(TCRParams)
