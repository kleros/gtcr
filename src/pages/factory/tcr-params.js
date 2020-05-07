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

const TCRParams = ({
  handleSubmit,
  formId,
  errors,
  setFieldValue,
  touched,
  ...rest
}) => {
  const { values, setTcrState } = rest
  const [uploading, setUploading] = useState({})
  const [advancedOptions, setAdvancedOptions] = useState()
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
          placeholder="Token² Curated List"
          label={
            <span>
              Title&nbsp;
              <Tooltip title="We suggest keeping the TCR title as short as possible for improved readability in mobile devices. In addition, some services such as twitter bots and push notifications can limit the number of characters per message, so using as few as possible on the title leaves room for more descriptive messages.">
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
          placeholder="A token curated list of tokens powered by Kleros..."
          hasFeedback
          error={errors.tcrDescription}
          touched={touched.tcrDescription}
          label={
            <span>
              Description&nbsp;
              <Tooltip title="A short sentence describing the what are the the TCR items and its listing criteria.">
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
                title={`What is the item? This a noun will replace the word "item" in the TCR interface and notifications. For example, if we set this to the "Meme" on the TCR interface you will see buttons such as "Submit Meme" and "Challenge Meme". Similarly, notification messages will look something like "Someone submitted a Meme to Meme TCR. Review it for a chance to win up to X ETH!".`}
              >
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="submissionBaseDeposit"
          placeholder="0.1 ETH"
          addonAfter="ETH"
          error={errors.submissionBaseDeposit}
          touched={touched.submissionBaseDeposit}
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
          name="removalBaseDeposit"
          placeholder="0.1 ETH"
          addonAfter="ETH"
          error={errors.removalBaseDeposit}
          touched={touched.removalBaseDeposit}
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
          name="submissionChallengeBaseDeposit"
          placeholder="0.05 ETH"
          addonAfter="ETH"
          error={errors.submissionChallengeBaseDeposit}
          touched={touched.submissionChallengeBaseDeposit}
          type={itemTypes.NUMBER}
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
        <CustomInput
          name="removalChallengeBaseDeposit"
          placeholder="0.05 ETH"
          addonAfter="ETH"
          error={errors.removalChallengeBaseDeposit}
          touched={touched.removalChallengeBaseDeposit}
          type={itemTypes.NUMBER}
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
              <Tooltip title="This should be a pdf file with the registry acceptance criteria.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </label>
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
              <span>TCR Logo&nbsp;</span>
              <Tooltip title="The TCR logo. Should be a 1:1 aspect ratio image with transparent background in SVG or PNG.">
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
                  <Tooltip title="The address of the arbitrator to use for this TCR.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="arbitratorExtraData"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.arbitratorExtraData}
              touched={touched.arbitratorExtraData}
              label={
                <span>
                  Arbitrator Extra Data&nbsp;
                  <Tooltip title="The extra data for the arbitrator. See ERC 792 for more information.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="governorAddress"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.governorAddress}
              touched={touched.governorAddress}
              label={
                <span>
                  Governor&nbsp;
                  <Tooltip title="The address of the governor to use for this TCR.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <Field name="requireRemovalEvidence">
              {({ field }) => (
                <Form.Item
                  label="Require evidence for removing items"
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
            <CustomInput
              name="sharedStakeMultiplier"
              placeholder="1000"
              error={errors.sharedStakeMultiplier}
              touched={touched.sharedStakeMultiplier}
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
              name="winnerStakeMultiplier"
              placeholder="1000"
              error={errors.winnerStakeMultiplier}
              touched={touched.winnerStakeMultiplier}
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
              name="looserStakeMultiplier"
              placeholder="2000"
              error={errors.looserStakeMultiplier}
              touched={touched.looserStakeMultiplier}
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
  ).isRequired
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
