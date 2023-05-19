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
  InputNumber,
  Button,
  Divider
} from 'antd'
import { withFormik } from 'formik'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import styled from 'styled-components/macro'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce/lib'
import { getAddress, bigNumberify, parseEther } from 'ethers/utils'
import CustomInput from 'components/custom-input'
import { ItemTypes } from '@kleros/gtcr-encoder'
import ipfsPublish from 'utils/ipfs-publish'
import { sanitize } from 'utils/string'
import useArbitrationCost from 'hooks/arbitration-cost'
import KlerosParams from './kleros-params'
import BaseDepositInput from 'components/base-deposit-input'
import ETHAmount from 'components/eth-amount'
import useWindowDimensions from 'hooks/window-dimensions'
import useNativeCurrency from 'hooks/native-currency'
import { klerosAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledUpload = styled(Upload)`
  & > .ant-upload.ant-upload-select-picture-card {
    width: 100%;
  }
`

const StyledAlert = styled(Alert)`
  margin-bottom: 32px;
`

const StyledDepositContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

const StyledSliderContainer = styled.div`
  display: flex;
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
  const { values, setTcrState, nextStep } = rest
  const { width } = useWindowDimensions()
  const [uploading, setUploading] = useState()
  const [advancedOptions, setAdvancedOptions] = useState()
  const { library, networkId } = useWeb3Context()
  const [depositVal, setDepositVal] = useState(0.05)
  const [debouncedArbitrator] = useDebounce(values.relArbitratorAddress, 1000)
  const { arbitrator: klerosAddress, policy: policyAddress } =
    klerosAddresses[networkId] || {}
  const { arbitrationCost } = useArbitrationCost({
    address: values.relArbitratorAddress,
    arbitratorExtraData: values.relArbitratorExtraData,
    library
  })
  const nativeCurrency = useNativeCurrency()
  const setRelArbitratorExtraData = useCallback(
    val => setFieldValue('relArbitratorExtraData', val),
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
        onSuccess('ok', parseIpfs(fileURI))
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

  const onChangeDepositVal = useCallback(
    value => {
      if (isNaN(value)) return

      setDepositVal(value)
      setFieldValue('relSubmissionBaseDeposit', value)
      setFieldValue('relRemovalBaseDeposit', value)
      setFieldValue('relRemovalChallengeBaseDeposit', value)
    },
    [setFieldValue]
  )

  const onSkipStep = useCallback(() => {
    setTcrState(prevState => ({
      ...prevState,
      relTcrDisabled: true
    }))
    nextStep()
  }, [nextStep, setTcrState])

  const totalDepositSlider = useMemo(() => {
    if (!arbitrationCost) return null
    const d = parseEther(Number(depositVal).toString())
    const a = arbitrationCost || bigNumberify(0)
    return bigNumberify(d).add(bigNumberify(a))
  }, [arbitrationCost, depositVal])

  return (
    <Card title="Choose the parameters of the Badges list">
      <Form
        layout="vertical"
        id={formId}
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Alert
          message="This step can be skipped"
          description={
            <div>
              Badges allow the users viewing an item on your list to quickly
              learn that it is also present in another list. To better
              understand how this can be useful, consider a list of clothing
              brands: A user is viewing brand X may be interested in knowing
              that it is also included in the 'Eco-friendly Brands' list.
            </div>
          }
          type="info"
          showIcon
        />
        <Button
          onClick={onSkipStep}
          style={{ margin: '24px 0', alignSelf: 'flex-end' }}
        >
          Skip step
        </Button>
        <Divider />
        <div style={{ marginBottom: '26px' }}>
          <div className="ant-col ant-form-item-label">
            <label htmlFor="rel-primary-document">
              <span>Acceptance Criteria (Primary Document)&nbsp;</span>
              <Tooltip title="The list primary document defines the acceptance criteria that jurors and challengers will use to evaluate submissions. For a Badge list, the primary document should define what lists are considered interesting to the viewers of your list. Use the PDF file format.">
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
                href={parseIpfs(values.relTcrPrimaryDocument)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon type="file-pdf" style={{ fontSize: '30px' }} />
              </a>
            ) : (
              <UploadButton loading={uploading} />
            )}
          </StyledUpload>
        </div>
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
                    />{' '}
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
        ) : (
          <KlerosParams
            arbitratorExtraData={values.relArbitratorExtraData}
            klerosAddress={debouncedArbitrator}
            policyAddress={policyAddress}
            setArbitratorExtraData={setRelArbitratorExtraData}
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
              name="relSubmissionBaseDeposit"
              error={errors.relSubmissionBaseDeposit}
              touched={touched.relSubmissionBaseDeposit}
              arbitrationCost={arbitrationCost}
              label={
                <span>
                  Submission Challenge Bounty&nbsp;
                  <Tooltip title="This will be the deposit required to submit connect a badge and also the amount awarded to successful challengers. If the value is too low, people will not look for flaws in the submissions and bad ones could make it through. If it is too high, the list will be secure, but people will be afraid to connect badges so there will be few available badges.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <BaseDepositInput
              name="relRemovalBaseDeposit"
              error={errors.relRemovalBaseDeposit}
              touched={touched.relRemovalBaseDeposit}
              arbitrationCost={arbitrationCost}
              label={
                <span>
                  Removal Challenge Bounty&nbsp;
                  <Tooltip title=" This will be the deposit required to disconnect a badge and also the amount awarded to successful challengers. If the value is too low, people will not look for flaws in removal requests and compliant badges could be disconnected. If it is too high, people will be afraid to remove non compliant badges, so a badge that should not be registerd would stay longer than it should.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <BaseDepositInput
              name="relSubmissionChallengeBaseDeposit"
              error={errors.relSubmissionChallengeBaseDeposit}
              touched={touched.relSubmissionChallengeBaseDeposit}
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
              name="relRemovalChallengeBaseDeposit"
              error={errors.relRemovalChallengeBaseDeposit}
              touched={touched.relRemovalChallengeBaseDeposit}
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
              name="relChallengePeriodDuration"
              placeholder="5"
              addonAfter="Hours"
              error={errors.relChallengePeriodDuration}
              touched={touched.relChallengePeriodDuration}
              type={ItemTypes.NUMBER}
              step={1}
              label={
                <span>
                  Challenge Period Duration (hours)&nbsp;
                  <Tooltip title="The length of time (in hours) that a submission can be challenged before it it automatically accepted onto the list and the submitter's deposit is refunded.">
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
                    title={`The address of the governor to use for this list. It can update parameters such as the challenge period duration, deposits, primary document and the list governor. By default it is set to ${defaultGovernorLabel}`}
                  >
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
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
                    title={`The address of the arbitrator to use for this list. By default it is set to ${defaultArbLabel}.`}
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
              showIcon
            />
            <StyledAlert
              message="The total cost to fully fund one side of an appeal is: Total Appeal Cost=Total Juror Fees+Total Juror Fees*Stake Multiplier"
              type="info"
              showIcon
            />
            <CustomInput
              name="relSharedStakeMultiplier"
              placeholder="100"
              error={errors.relSharedStakeMultiplier}
              touched={touched.relSharedStakeMultiplier}
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
              name="relWinnerStakeMultiplier"
              placeholder="100"
              error={errors.relWinnerStakeMultiplier}
              touched={touched.relWinnerStakeMultiplier}
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
              name="relLoserStakeMultiplier"
              placeholder="200"
              error={errors.relLoserStakeMultiplier}
              touched={touched.relLoserStakeMultiplier}
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
    .max(42, 'Ethereum addresses are 42 characters long.'),
  relArbitratorExtraData: yup
    .string()
    .required('The arbitrator extra data is required.'),
  relGovernorAddress: yup
    .string()
    .required('A governor address is required.')
    .max(42, 'Ethereum addresses are 42 characters long.'),
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
    .typeError('Amount should be a number.')
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  relWinnerStakeMultiplier: yup
    .number()
    .typeError('Amount should be a number.')
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
  relLoserStakeMultiplier: yup
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
  handleSubmit: (_, { props: { postSubmit, setTcrState } }) => {
    setTcrState(prevState => {
      delete prevState.relTcrDisabled
      return prevState
    })
    postSubmit()
  }
})(RelTCRParams)
