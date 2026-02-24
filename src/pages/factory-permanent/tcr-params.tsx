import React, { useEffect, useState, useCallback, useMemo } from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { responsiveSize } from 'styles/responsive-size'
import {
  Card,
  Tooltip,
  Form,
  Switch,
  Alert,
  Slider,
  InputNumber,
  Select,
} from 'components/ui'
import Icon from 'components/ui/Icon'
import { toast } from 'react-toastify'
import { withFormik } from 'formik'
import * as yup from 'yup'
import { useDebounce } from 'use-debounce'
import { ethers, BigNumber } from 'ethers'

const { getAddress, parseEther } = ethers.utils
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEthersProvider } from 'hooks/ethers-adapters'
import CustomInput from 'components/custom-input'
import { ItemTypes } from '@kleros/gtcr-encoder'
import ipfsPublish from 'utils/ipfs-publish'
import { sanitize } from 'utils/string'
import useArbitrationCost from 'hooks/arbitration-cost'
import KlerosParams from './kleros-params'
import ETHAmount from 'components/eth-amount'
import useWindowDimensions from 'hooks/window-dimensions'
import useNativeCurrency from 'hooks/native-currency'
import { useNavigate } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { klerosAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { UploadButton, StyledUpload } from 'components/input-selector'
import PGTCRDepositInput from 'components/pgtcr-deposit-input'
import useTokenSymbol from 'hooks/token-symbol'

export const StyledAlert = styled(Alert)`
  margin-bottom: 32px;
`

export const StyledTCRParamContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12px;

  ${smallScreenStyle(
    () => css`
      flex-direction: column;
    `,
  )}
`

export const StyledUploadContainer = styled.div`
  margin-right: ${responsiveSize(0, 12)};
  max-width: ${responsiveSize(300, 450)};
  color: ${({ theme }) => theme.textPrimary};
  display: flex;
  flex-direction: column;
  gap: 20px;

  label,
  span {
    color: ${({ theme }) => theme.textPrimary};
  }

  .ui-form-item-label label {
    display: inline-flex;
    align-items: center;
  }

  & > div {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`

export const StyledTCRInfoContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-left: 1px solid ${({ theme }) => theme.borderColor};
  padding-left: ${responsiveSize(6, 12)};
`

export const StyledDepositContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

export const StyledSliderContainer = styled.div`
  display: flex;
`

export const StyledP = styled.p`
  color: ${({ theme }) => theme.textPrimary};
  margin: 0;
`

export const StyledFontAwesomeIcon = styled(FontAwesomeIcon)`
  margin-right: 12px;
  color: ${({ theme }) => theme.textSecondary};
`

export const CheapestAndSafestContainer = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  margin-right: 24px;
  color: ${({ theme }) => theme.textSecondary};
`

export const StyledImg = styled.img`
  height: 70px;
  object-fit: contain;
`

export const UploadSection = styled.div`
  margin-bottom: 26px;
`

interface TCRParamsProps {
  handleSubmit: (...args: unknown[]) => void
  formId: string
  errors: Record<string, unknown>
  setFieldValue: (field: string, value: unknown) => void
  touched: Record<string, unknown>
  defaultArbLabel: string
  defaultArbDataLabel: string
  defaultGovernorLabel: string
  values: Record<string, unknown>
  setTcrState: (
    fn: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void
  [key: string]: unknown
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
}: TCRParamsProps) => {
  const { values, setTcrState } = rest
  const { width } = useWindowDimensions()
  const nativeCurrency = useNativeCurrency()
  const [uploading, setUploading] = useState({})
  const [advancedOptions, setAdvancedOptions] = useState<any>()
  const [depositVal, setDepositVal] = useState(0.05)
  const navigate = useNavigate()
  const chainId = useUrlChainId()
  const chainProvider = useEthersProvider({ chainId: chainId ?? undefined })
  const [debouncedArbitrator] = useDebounce(values.arbitratorAddress, 1000)
  const { arbitrator: klerosAddress, policy: policyAddress } =
    klerosAddresses[chainId as keyof typeof klerosAddresses] || {}
  const { arbitrationCost } = useArbitrationCost({
    address: values.arbitratorAddress,
    arbitratorExtraData: values.arbitratorExtraData,
    library: chainProvider,
  })
  const { symbol: tokenSymbol } = useTokenSymbol(values.tokenAddress)
  const setArbitratorExtraData = useCallback(
    (val) => setFieldValue('arbitratorExtraData', val),
    [setFieldValue],
  )

  let isKlerosArbitrator
  try {
    isKlerosArbitrator =
      getAddress(debouncedArbitrator) === getAddress(klerosAddress)
  } catch {
    isKlerosArbitrator = false
  }

  useEffect(() => {
    setTcrState((previousState) => ({
      ...previousState,
      ...values,
    }))
  }, [values, setTcrState])

  const fileUploadStatusChange = useCallback(
    ({ file: { status }, file }) => {
      if (status === 'done') toast.success(`File uploaded successfully.`)
      else if (status === 'error') toast.error(`File upload failed.`)
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
    [uploading],
  )

  const beforeImageUpload = useCallback((file) => {
    const isSupportedImage =
      file.type === 'image/png' ||
      file.type === 'image/svg+xml' ||
      file.type === 'image/webp' ||
      file.type === 'image/jpeg'
    if (!isSupportedImage) toast.error('Please use PNG, webp, jpeg or SVG.')

    const isLt2M = file.size / 1024 / 1024 < 2
    if (!isLt2M) toast.error('Image must be smaller than 2MB.')

    return isSupportedImage && isLt2M
  }, [])

  const beforeFileUpload = useCallback((file) => {
    const isPDF = file.type === 'application/pdf'
    if (!isPDF) toast.error('Please upload file as PDF.')

    const isLt4M = file.size / 1024 / 1024 < 4
    if (!isLt4M) toast.error('File must be smaller than 4MB.')

    return isPDF && isLt4M
  }, [])

  const customRequest = useCallback(
    (fieldName) =>
      async ({ file, onSuccess, onError }) => {
        try {
          const data = await new Response(new Blob([file])).arrayBuffer()
          const fileURI = getIPFSPath(
            await ipfsPublish(sanitize(file.name), data),
          )

          setFieldValue(fieldName, fileURI)
          onSuccess('ok', parseIpfs(fileURI))
        } catch {
          console.error(err)
          onError(err)
        }
      },
    [setFieldValue],
  )

  const onChangeDepositVal = useCallback(
    (value) => {
      if (isNaN(value)) return

      setDepositVal(value)
      setFieldValue('submissionMinDeposit', value)
      setFieldValue('removalBaseDeposit', value)
      setFieldValue('removalChallengeBaseDeposit', value)
    },
    [setFieldValue],
  )

  const totalDepositSlider = useMemo(() => {
    if (!arbitrationCost) return null
    const d = parseEther(Number(depositVal).toString())
    const a = arbitrationCost || BigNumber.from(0)
    return BigNumber.from(d).add(BigNumber.from(a))
  }, [arbitrationCost, depositVal])

  return (
    <Card
      title="Enter the list parameters"
      extra={
        <StyledP>
          Factory Type:{' '}
          <Select
            defaultValue="permanent"
            style={{ width: 120, marginLeft: 8 }}
            onChange={(value) => {
              if (value === 'classic') navigate(`/factory-classic/${chainId}`)
              else if (value === 'light') navigate(`/factory/${chainId}`)
            }}
          >
            <Select.Option value="classic">Classic</Select.Option>
            <Select.Option value="light">Light</Select.Option>
            <Select.Option value="permanent">Permanent</Select.Option>
          </Select>
        </StyledP>
      }
    >
      <Form layout="vertical" id={formId} onSubmit={handleSubmit}>
        <StyledTCRParamContainer>
          <StyledUploadContainer>
            <div>
              <div className="ui-col ui-form-item-label">
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
                  <StyledImg src={parseIpfs(values.tcrLogo)} alt="avatar" />
                ) : (
                  <UploadButton loading={uploading.tcrLogo} />
                )}
              </StyledUpload>
            </div>
            <div>
              <div className="ui-col ui-form-item-label">
                <label htmlFor="primary-document">
                  <span>Acceptance Criteria (Primary Document)&nbsp;</span>
                  <Tooltip title="The list primary document defines the acceptance criteria that jurors and challengers will use to evaluate submissions. Use the PDF file format.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </label>
                <br />
                Click{' '}
                <a
                  href="https://cdn.kleros.link/ipfs/QmUPsjDcKxNv6z6ktnmxkSb4LpqmQ7DT12yG5B73z9uLEy/curated-lists-primary-document.pdf"
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
                  <a href={parseIpfs(values.tcrPrimaryDocument)}>
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
              <CheapestAndSafestContainer>
                {width > 480 && (
                  <>
                    <StyledFontAwesomeIcon icon="coins" />
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
                    <StyledFontAwesomeIcon icon="shield-alt" /> Safest
                  </>
                )}
              </CheapestAndSafestContainer>
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
            library={chainProvider}
          />
        )}
        <Form.Item
          label="Advanced options"
          style={{ marginBottom: '12px', display: 'flex' }}
        >
          <Switch
            onChange={() => setAdvancedOptions((toggle) => !toggle)}
            style={{ marginLeft: '8px' }}
          />
        </Form.Item>
        {advancedOptions && (
          <>
            <PGTCRDepositInput
              name="submissionMinDeposit"
              error={errors.submissionMinDeposit}
              touched={touched.submissionMinDeposit}
              arbitrationCost={arbitrationCost}
              tokenSymbol={tokenSymbol}
              label={
                <span>
                  Min Submission Deposit&nbsp;
                  <Tooltip title="This is the minimum amount for the deposit backing up an item in the list, which is to be awarded to successful challengers. If the value is too low, challengers may not have enough incentive to look for flaws in most of the submissions and bad ones could make it through. If it is too high, submitters may not have enough incentive to send items which may result in an empty list.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="submissionPeriodDuration"
              placeholder="84"
              addonAfter="Hours"
              error={errors.submissionPeriodDuration}
              touched={touched.submissionPeriodDuration}
              type={ItemTypes.NUMBER}
              step={1}
              label={
                <span>
                  Submission Period Duration (hours) &nbsp;
                  <Tooltip title="The length of time (in hours) that a freshly submitted item needs to last without challenges before it it considered accepted onto the list.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="reinclusionPeriodDuration"
              placeholder="6"
              addonAfter="Hours"
              error={errors.reinclusionPeriodDuration}
              touched={touched.reinclusionPeriodDuration}
              type={ItemTypes.NUMBER}
              step={1}
              label={
                <span>
                  Reinclusion Period Duration (hours) &nbsp;
                  <Tooltip title="The length of time (in hours) that an item ruled to be kept included needs to last without challenges before it it considered accepted onto the list.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="withdrawingPeriodDuration"
              placeholder="84"
              addonAfter="Hours"
              error={errors.withdrawingPeriodDuration}
              touched={touched.withdrawingPeriodDuration}
              type={ItemTypes.NUMBER}
              step={1}
              label={
                <span>
                  Withdrawing Period Duration (hours) &nbsp;
                  <Tooltip title="The length of time (in hours) that an item takes to be manually withdrawn by its submitter.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="arbitrationParamsCooldown"
              placeholder="168"
              addonAfter="Hours"
              error={errors.arbitrationParamsCooldown}
              touched={touched.arbitrationParamsCooldown}
              type={ItemTypes.NUMBER}
              step={1}
              label={
                <span>
                  Arbitration Parameters Cooldown (hours) &nbsp;
                  <Tooltip title="The length of time (in hours) that a new Policy and Arbitration Settings need to be put into effect.">
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
            <CustomInput
              name="tokenAddress"
              placeholder="0x7331deadbeef..."
              hasFeedback
              error={errors.tokenAddress}
              touched={touched.tokenAddress}
              label={
                <span>
                  Token Address&nbsp;
                  <Tooltip title="The address of the ERC-20 token that will be used for deposits. Default is sDAI token address.">
                    <Icon type="question-circle-o" />
                  </Tooltip>
                </span>
              }
              {...rest}
            />
            <CustomInput
              name="challengeStakeMultiplier"
              placeholder="50"
              error={errors.challengeStakeMultiplier}
              touched={touched.challengeStakeMultiplier}
              type={ItemTypes.NUMBER}
              addonAfter="%"
              label={
                <span>
                  Challenge stake multiplier&nbsp;
                  <Tooltip title="This is the multiplier for the stake the challenger must pay to create a dispute against an item, which will be reimbursed if the challenge is successful, or get reinvested into the item stake if the challenge fails.">
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
  tokenAddress: yup
    .string()
    .required('A token address is required.')
    .max(42, 'Ethereum addresses are 42 characters long.'),
  itemName: yup
    .string()
    .required('An item name is required.')
    .max(20, 'The item name must be less than 20 characters long.'),
  itemNamePlural: yup
    .string()
    .required('The plural of the item name is required.')
    .max(20, 'The item name must be less than 20 characters long.'),
  submissionMinDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  submissionPeriodDuration: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  reinclusionPeriodDuration: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  withdrawingPeriodDuration: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  arbitrationParamsCooldown: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  tcrPrimaryDocument: yup.string().required('A primary document is required.'),
  tcrLogo: yup.string().required('A logo is required.'),
  challengeStakeMultiplier: yup
    .number()
    .typeError('Amount should be a number.')
    .min(0, 'The stake multiplier cannot be negative.')
    .required('A value is required'),
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
    .required('A value is required'),
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
  },
})(TCRParams)
