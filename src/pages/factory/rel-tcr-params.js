import React, { useEffect, useState, useCallback } from 'react'
import { Card, Icon, Tooltip, Form, Switch, Upload, message } from 'antd'
import { withFormik, Field } from 'formik'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import styled from 'styled-components/macro'
import CustomInput from '../../components/custom-input'
import itemTypes from '../../utils/item-types'
import ipfsPublish from '../../utils/ipfs-publish'
import { sanitize } from '../../utils/string'

const StyledUpload = styled(Upload)`
  & > .ant-upload.ant-upload-select-picture-card {
    width: 100%;
  }
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

const RelTCRParams = ({
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
  const [uploading, setUploading] = useState()
  const [advancedOptions, setAdvancedOptions] = useState()
  useEffect(() => {
    setTcrState(previousState => ({
      ...previousState,
      ...values
    }))
  }, [values, setTcrState])

  const fileUploadStatusChange = useCallback(({ file: { status } }) => {
    if (status === 'done') message.success(`File uploaded successfully.`)
    else if (status === 'error') message.error(`File upload failed.`)
    else if (status === 'uploading') setUploading(true)

    if (status === 'error' || status === 'done') setUploading(false)
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

  const beforeFileUpload = useCallback(file => {
    const isPDF = file.type === 'application/pdf'
    if (!isPDF) message.error('Please upload file as PDF.')

    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) message.error('File must smaller than 10MB.')

    return isPDF && isLt10M
  }, [])

  return (
    <Card title="Choose the parameters of the Badges TCR">
      <Form layout="vertical" id={formId} onSubmit={handleSubmit}>
        <CustomInput
          name="relSubmissionBaseDeposit"
          placeholder="0.1 ETH"
          addonAfter="ETH"
          error={errors.relSubmissionBaseDeposit}
          touched={touched.relSubmissionBaseDeposit}
          type={itemTypes.NUMBER}
          label={
            <span>
              Submission Deposit&nbsp;
              <Tooltip title="This will be the deposit required to submit an item. It is also the amount awarded to successful challengers.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="relRemovalBaseDeposit"
          placeholder="0.1 ETH"
          addonAfter="ETH"
          error={errors.relRemovalBaseDeposit}
          touched={touched.relRemovalBaseDeposit}
          type={itemTypes.NUMBER}
          label={
            <span>
              Removal Deposit&nbsp;
              <Tooltip title="This will be the deposit required to remove an item. It is also the amount awarded to successful challengers.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="relSubmissionChallengeBaseDeposit"
          placeholder="0.05 ETH"
          addonAfter="ETH"
          error={errors.relSubmissionChallengeBaseDeposit}
          touched={touched.relSubmissionChallengeBaseDeposit}
          type={itemTypes.NUMBER}
          label={
            <span>
              Challenge Submission Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a submission. It will be either reimbursed to the challenger or awarded to the submitter depending on who wins the dispute.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="relRemovalChallengeBaseDeposit"
          placeholder="0.05 ETH"
          addonAfter="ETH"
          error={errors.relRemovalChallengeBaseDeposit}
          touched={touched.relRemovalChallengeBaseDeposit}
          type={itemTypes.NUMBER}
          label={
            <span>
              Challenge Removal Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a removal request. It will be either reimbursed to the challenger or awarded to the party that removed the item depending on who wins the dispute.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="relChallengePeriodDuration"
          placeholder="5"
          addonAfter="Hours"
          error={errors.relChallengePeriodDuration}
          touched={touched.relChallengePeriodDuration}
          type={itemTypes.NUMBER}
          step={1}
          label={
            <span>
              Challenge Period Duration (hours)&nbsp;
              <Tooltip title="The length of the challenge period in hours.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <div style={{ marginBottom: '26px' }}>
          <div className="ant-col ant-form-item-label">
            <label htmlFor="rel-primary-document">
              <span>Primary Document&nbsp;</span>
            </label>
          </div>
          <StyledUpload
            name="rel-primary-document"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={customRequest('relTcrPrimaryDocument')}
            beforeUpload={beforeFileUpload}
            onChange={fileUploadStatusChange}
          >
            {values.relTcrPrimaryDocument ? (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`${process.env.REACT_APP_IPFS_GATEWAY}${values.relTcrPrimaryDocument}`}
              >
                <Icon type="file-pdf" style={{ fontSize: '30px' }} />
              </a>
            ) : (
              <UploadButton loading={uploading} />
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
        {advancedOptions && (
          <>
            <CustomInput
              name="relArbitratorAddress"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.relArbitratorAddress}
              touched={touched.relArbitratorAddress}
              label={
                <span>
                  Arbitrator&nbsp;
                  <Tooltip
                    title={`The address of the arbitrator to use for this TCR. By default it is set to ${defaultArbLabel}.`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="relArbitratorExtraData"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.relArbitratorExtraData}
              touched={touched.relArbitratorExtraData}
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
            <CustomInput
              name="relGovernorAddress"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.relGovernorAddress}
              touched={touched.relGovernorAddress}
              label={
                <span>
                  Governor&nbsp;
                  <Tooltip
                    title={`The address of the governor to use for this TCR. It can update parameters such as the challenge period duration, deposits, primary document and the TCR governor. By default it is set to ${defaultGovernorLabel}`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <Field name="relRequireRemovalEvidence">
              {({ field }) => (
                <Form.Item
                  label="Require evidence for removing items"
                  style={{ marginBottom: '12px', display: 'flex' }}
                >
                  <Switch
                    onChange={value =>
                      setFieldValue('relRequireRemovalEvidence', value)
                    }
                    style={{ marginLeft: '8px' }}
                    checked={field.value}
                  />
                </Form.Item>
              )}
            </Field>
            <CustomInput
              name="relSharedStakeMultiplier"
              placeholder="1000"
              error={errors.relSharedStakeMultiplier}
              touched={touched.relSharedStakeMultiplier}
              type={itemTypes.NUMBER}
              label={
                <span>
                  Shared stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the stake parties must pay to raise an appeal when there isn't a winner or looser (e.g. when its the first round or the arbitrator refused to rule).">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="relWinnerStakeMultiplier"
              placeholder="1000"
              error={errors.relWinnerStakeMultiplier}
              touched={touched.relWinnerStakeMultiplier}
              type={itemTypes.NUMBER}
              label={
                <span>
                  Shared stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the stake the winner of a round must pay to raise an appeal.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="relLooserStakeMultiplier"
              placeholder="2000"
              error={errors.relLooserStakeMultiplier}
              touched={touched.relLooserStakeMultiplier}
              type={itemTypes.NUMBER}
              label={
                <span>
                  Shared stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the stake the looser of a round must pay to raise an appeal.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
          </>
        )}
      </Form>
    </Card>
  )
}

RelTCRParams.propTypes = {
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
  relArbitratorAddress: yup
    .string()
    .required('An arbitrator address is required.')
    .max(160, 'Ethereum addresses are 42 characters long.'),
  relArbitratorExtraData: yup
    .string()
    .required('The arbitrator extra data is required.'),
  relGovernorAddress: yup
    .string()
    .required('A governor address is required.')
    .max(160, 'Ethereum addresses are 42 characters long.'),
  relSubmissionBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  relRemovalBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  relSubmissionChallengeBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  relRemovalChallengeBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  relChallengePeriodDuration: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  relTcrPrimaryDocument: yup
    .string()
    .required('A primary document is required.'),
  relSharedStakeMultiplier: yup
    .number()
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  relWinnerStakeMultiplier: yup
    .number()
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  relLooserStakeMultiplier: yup
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
})(RelTCRParams)
