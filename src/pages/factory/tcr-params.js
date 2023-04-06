import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card,
  Icon,
  Tooltip,
  Form,
  Switch,
  Upload,
  message,
  Alert,
  Slider,
  InputNumber
} from 'antd'
import { withFormik } from 'formik'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import styled from 'styled-components/macro'
import { useDebounce } from 'use-debounce/lib'
import { getAddress, parseEther, bigNumberify } from 'ethers/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useWeb3Context } from 'web3-react'
import CustomInput from 'components/custom-input'
import { ItemTypes } from '@kleros/gtcr-encoder'
import ipfsPublish from 'utils/ipfs-publish'
import { sanitize } from 'utils/string'
import BaseDepositInput from 'components/base-deposit-input'
import useArbitrationCost from 'hooks/arbitration-cost'
import KlerosParams from './kleros-params'
import ETHAmount from 'components/eth-amount'
import useWindowDimensions from 'hooks/window-dimensions'
import useNativeCurrency from 'hooks/native-currency'
import { useHistory } from 'react-router'
import { klerosAddresses } from 'config/tcr-addresses'

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

const StyledTCRParamContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12px;

  @media (max-width: 840px) {
    flex-direction: column;
  }
`

const StyledUploadContainer = styled.div`
  @media (min-width: 840px) {
    margin-right: 12px;
    max-width: 450px;
  }
`

const StyledTCRInfoContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media (min-width: 840px) {
    border-left: 1px solid #f8efff;
    padding-left: 12px;
  }
`

const StyledDepositContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

const StyledSliderContainer = styled.div`
  display: flex;
`

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
  const { width } = useWindowDimensions()
  const nativeCurrency = useNativeCurrency()
  const [uploading, setUploading] = useState({})
  const [advancedOptions, setAdvancedOptions] = useState()
  const { library, networkId } = useWeb3Context()
  const [depositVal, setDepositVal] = useState(0.05)
  const history = useHistory()
  const [debouncedArbitrator] = useDebounce(values.arbitratorAddress, 1000)
  const { arbitrator: klerosAddress, policy: policyAddress } =
    klerosAddresses[networkId] || {}
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
        if (
          file.type === 'image/png' ||
          file.type === 'image/svg+xml' ||
          file.type === 'image/webp' ||
          file.type === 'image/jpeg'
        )
          setUploading({ ...uploading, tcrLogo: true })
        else setUploading({ ...uploading, tcrPrimaryDocument: true })

      if (status === 'error' || status === 'done')
        if (
          file.type === 'image/png' ||
          file.type === 'image/svg+xml' ||
          file.type === 'image/webp' ||
          file.type === 'image/jpeg'
        )
          setUploading({ ...uploading, tcrLogo: false })
        else setUploading({ ...uploading, tcrPrimaryDocument: false })
    },
    [uploading]
  )

  const beforeImageUpload = useCallback(file => {
    const isSupportedImage =
      file.type === 'image/png' ||
      file.type === 'image/svg+xml' ||
      file.type === 'image/webp' ||
      file.type === 'image/jpeg'
    if (!isSupportedImage) message.error('Please use PNG, webp, jpeg or SVG.')

    const isLt2M = file.size / 1024 / 1024 < 2
    if (!isLt2M) message.error('Image must smaller than 2MB.')

    return isSupportedImage && isLt2M
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

  const onChangeDepositVal = useCallback(
    value => {
      if (isNaN(value)) return

      setDepositVal(value)
      setFieldValue('submissionBaseDeposit', value)
      setFieldValue('removalBaseDeposit', value)
      setFieldValue('removalChallengeBaseDeposit', value)
    },
    [setFieldValue]
  )

  const totalDepositSlider = useMemo(() => {
    if (!arbitrationCost) return null
    const d = parseEther(Number(depositVal).toString())
    const a = arbitrationCost || bigNumberify(0)
    return bigNumberify(d).add(bigNumberify(a))
  }, [arbitrationCost, depositVal])

  return (
    <Card
      title="Enter the list parameters"
      extra={
        <p style={{ color: 'white' }}>
          Use Classic{' '}
          <Switch onClick={() => history.push(`/factory-classic`)} />
        </p>
      }
    >
      <Form layout="vertical" id={formId} onSubmit={handleSubmit}>
        <StyledTCRParamContainer>
          <StyledUploadContainer>
            <div>
              <div className="ant-col ant-form-item-label">
                <label htmlFor="tcr-logo">
                  <span>List Logo (transparent background): &nbsp;</span>
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
            <div>
              <div className="ant-col ant-form-item-label">
                <label htmlFor="primary-document">
                  <span>Acceptance Criteria (Primary Document)&nbsp;</span>
                  <Tooltip title="The list primary document defines the acceptance criteria that jurors and challengers will use to evaluate submissions. Use the PDF file format.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </label>
                <br />
                Click{' '}
                <a
                  href="https://ipfs.kleros.io/ipfs/QmUPsjDcKxNv6z6ktnmxkSb4LpqmQ7DT12yG5B73z9uLEy/curated-lists-primary-document.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  here
                </a>{' '}
                to see an example.
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
                    href={`${process.env.REACT_APP_IPFS_GATEWAY}${values.tcrPrimaryDocument}`}
                  >
                    <Icon type="file-pdf" style={{ fontSize: '30px' }} />
                  </a>
                ) : (
                  <UploadButton loading={uploading.tcrPrimaryDocument} />
                )}
              </StyledUpload>
            </div>
          </StyledUploadContainer>
          <StyledTCRInfoContainer>
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
                  <Tooltip title="Enter a short sentence to describe the type of item that will be displayed in the list and what the listing criteria are. For example: Images of red socks from various manufacturers.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              style={{ marginBottom: 0 }}
              name="itemName"
              placeholder="sock"
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
            <CustomInput
              style={{ marginBottom: 0 }}
              name="itemNamePlural"
              placeholder="socks"
              hasFeedback
              error={errors.itemNamePlural}
              touched={touched.itemNamePlural}
              label={
                <span>
                  Item Name Plural&nbsp;
                  <Tooltip
                    title={`This is the plural of the item name. In other words, if "Item Name" is "bus", this should be "buses"`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
          </StyledTCRInfoContainer>
        </StyledTCRParamContainer>
        {!advancedOptions && (
          <StyledDepositContainer>
            <label htmlFor="depositSlider">
              Deposit&nbsp;
              <Tooltip title="These are the funds users will have to deposit in order to make a submission into the list, which are sufficient to cover both arbitration costs paid to jurors and the rewards that users earn for a successful challenge. If the deposit is too low, incorrect submissions may not be flagged for dispute which could result in incorrect items being accepted in the list. If the deposit is too high, challengers will be likely to catch most malicious submissions, but people will only rarely submit to your list (so you may end up having a list that is difficult to attack but largely empty).">
                <Icon type="question-circle-o" />
              </Tooltip>
              :{' '}
              <ETHAmount
                amount={totalDepositSlider}
                decimals={3}
                displayUnit={` ${nativeCurrency}`}
              />
            </label>
            <StyledSliderContainer>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '24px'
                }}
              >
                {width > 480 && (
                  <>
                    <FontAwesomeIcon
                      icon="coins"
                      style={{ marginRight: '12px' }}
                    />
                    Cheapest
                  </>
                )}
                <Slider
                  id="depositSlider"
                  min={0}
                  max={30}
                  onChange={onChangeDepositVal}
                  value={typeof depositVal === 'number' ? depositVal : 0}
                  step={0.01}
                  style={{ flex: 1, margin: '0 24px' }}
                />
                {width > 480 && (
                  <>
                    <FontAwesomeIcon
                      icon="shield-alt"
                      style={{ marginRight: '12px' }}
                    />{' '}
                    Safest
                  </>
                )}
              </div>
              <InputNumber
                min={0}
                max={30}
                step={0.01}
                value={depositVal}
                onChange={onChangeDepositVal}
              />
            </StyledSliderContainer>
          </StyledDepositContainer>
        )}
        {isKlerosArbitrator === false ? (
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
            <BaseDepositInput
              name="submissionBaseDeposit"
              error={errors.submissionBaseDeposit}
              touched={touched.submissionBaseDeposit}
              arbitrationCost={arbitrationCost}
              label={
                <span>
                  Submission Challenge Bounty&nbsp;
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
                  Removal Challenge Bounty&nbsp;
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
                  Incorrect Challenge Compensation&nbsp;
                  <Tooltip title="This amount, which is included in the deposits that challengers must make, is given to the submitter in the event that a challenged submission is ultimately ruled to be correct. One typically wants Incorrect Challenge Compensation to be zero, because being on the list should be an adequate incentive for submitters. However, if you anticipate frivolous challenges being a problem, a higher Incorrect Challenge Compensation can help protect against this. If Incorrect Challenge Compensation is too high, users will be disincentivized from challenging and incorrect entries may make it onto the list unchallenged.">
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
                  Incorrect Removal Challenge Compensation&nbsp;
                  <Tooltip title="This amount, which is included in the deposits that challengers to removal requests must make, is given to the removal requestor in the event that a challenged removal request is ultimately ruled to be correct. If Incorrect Removal Challenge Compensation is too high, users will be disincentivized from challenging removal requests and correct entries may be removed from the list unchallenged. If Incorrect Removal Challenge Compensation is too low, users may not be adequately incentivized to submit removal requests, and incorrect entries may remain on the list longer than they should.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="challengePeriodDuration"
              placeholder="84"
              addonAfter="Hours"
              error={errors.challengePeriodDuration}
              touched={touched.challengePeriodDuration}
              type={ItemTypes.NUMBER}
              step={1}
              label={
                <span>
                  Challenge Period Duration (hours) &nbsp;
                  <Tooltip title="The length of time (in hours) that a submission can be challenged before it it automatically accepted onto the list and the submitter's deposit is refunded.">
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
                  <Tooltip
                    title={`The address of the governor to use for this list. It can update parameters such as the challenge period duration, deposits, primary document, etc. This address can also be used to transfer the role of governor to another address. By default this is set to ${defaultGovernorLabel}`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
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
                    title={`This is the contract address of the arbitrator that will resolve disputes regarding whether challenged submissions and challenged removal requests belong on this list. By default it is set to ${defaultArbLabel}, but you could use any other arbitrator complying with the ERC 792 standard.`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <StyledAlert
              message={
                <div>
                  To appeal, in addition to paying enough fees to cover the
                  payment to the jurors in case the appeal is lost, parties must
                  also pay an additional stake. The stake of the side that
                  ultimately loses the dispute is used as the reward given to
                  the appeal fee contributors that funded the side that
                  ultimately wins the dispute.
                  <br />
                  <br />
                  This amount is calculated proportionally to the total juror
                  fees required for appeal using the multipliers below, given in
                  percentage. For example, a multiplier of 10% will result in
                  the stake being 10% of the total juror fees.
                  <br />
                  <br />
                  If you choose very large stake multipliers, the expected
                  returns of crowdfunders will improve, but appeal costs may
                  become so large as to be a barrier. If you choose very small
                  stake multipliers, total appeal costs are reduced, but
                  crowdfunders may not be sufficiently incentivized to
                  participate. Different multipliers can be chosen for the sides
                  that won and lost the previous appeal round. The more one of
                  these multipliers is larger than the other, the more the side
                  with the smaller multiplier is favoured.
                </div>
              }
              type="info"
              showIcon
            />
            <StyledAlert
              message="The total cost to fully fund one side of an appeal is: Total Appeal Cost=Total Juror Fees+Total Juror Fees*Stake Multiplier"
              type="info"
              showIcon
            />
            <CustomInput
              name="sharedStakeMultiplier"
              placeholder="100"
              error={errors.sharedStakeMultiplier}
              touched={touched.sharedStakeMultiplier}
              type={ItemTypes.NUMBER}
              addonAfter="%"
              label={
                <span>
                  Shared stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the stake both parties must pay to fully fund their side of an appeal when there isn't a winner or loser (e.g. when the arbitrator refused to rule).">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="winnerStakeMultiplier"
              placeholder="100"
              error={errors.winnerStakeMultiplier}
              touched={touched.winnerStakeMultiplier}
              type={ItemTypes.NUMBER}
              addonAfter="%"
              label={
                <span>
                  Winner stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the fee stake the winner of a round must pay to fully fund his side of an appeal.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="loserStakeMultiplier"
              placeholder="200"
              error={errors.loserStakeMultiplier}
              touched={touched.loserStakeMultiplier}
              type={ItemTypes.NUMBER}
              addonAfter="%"
              label={
                <span>
                  Loser stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the fee stake the loser of a round must pay to fully fund his side of an appeal.">
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
  ).isRequired,
  defaultArbLabel: PropTypes.string.isRequired,
  defaultArbDataLabel: PropTypes.string.isRequired,
  defaultGovernorLabel: PropTypes.string.isRequired
}

const validationSchema = yup.object().shape({
  tcrTitle: yup
    .string()
    .required('A title is required.')
    .max(40, 'Title must be less than 40 characters long.'),
  tcrDescription: yup
    .string()
    .required('A description is required.')
    .max(255, 'Description must be less than 255 characters long.'),
  arbitratorAddress: yup
    .string()
    .required('An arbitrator address is required.')
    .max(42, 'Ethereum addresses are 42 characters long.'),
  arbitratorExtraData: yup
    .string()
    .required('The arbitrator extra data is required.'),
  governorAddress: yup
    .string()
    .required('A governor address is required.')
    .max(42, 'Ethereum addresses are 42 characters long.'),
  itemName: yup
    .string()
    .required('An item name is required.')
    .max(20, 'The item name must be less than 20 characters long.'),
  itemNamePlural: yup
    .string()
    .required('The plural of the item name is required.')
    .max(20, 'The item name must be less than 20 characters long.'),
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
    .typeError('Amount should be a number.')
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  winnerStakeMultiplier: yup
    .number()
    .typeError('Amount should be a number.')
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  loserStakeMultiplier: yup
    .number()
    .typeError('Amount should be a number.')
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
