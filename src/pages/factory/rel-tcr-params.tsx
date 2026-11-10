import React, { useEffect, useState, useCallback, useId } from 'react'
import { withFormik, type FormikProps } from 'formik'
import * as yup from 'yup'
import { useDebounce } from 'use-debounce'
import { ethers } from 'ethers'
import { Roles } from '@kleros/kleros-app'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useArbitrationCost from 'hooks/arbitration-cost'
import useNativeCurrency from 'hooks/native-currency'
import useUrlChainId from 'hooks/use-url-chain-id'
import { klerosAddresses } from 'config/tcr-addresses'
import { Row, Small, Stack } from 'components/curate/primitives'
import KlerosParams from './kleros-params'
import {
  Divider,
  FieldGrid,
  FormField,
  RangeInput,
  StepBody,
  StepHeader,
  SwitchField,
  TextField,
  TextLink,
  UploadField,
} from './fields'
import {
  AmountInput,
  AppealStakeNote,
  BaseDepositField,
  DepositTotalLine,
  POLICY_EXAMPLE_URL,
  SliderEnds,
} from './tcr-params'
import { relSchema } from './schemas'
import type { StepProps, TcrState } from '.'

const { getAddress } = ethers.utils

/*
 * Step 3, the badges list: a second list, deployed with the main one, that
 * holds the addresses of other lists whose entries count as badges on this
 * list's items. Off by default; when it is off, Next records the choice
 * (`relTcrDisabled`) and the deploy step publishes a closed placeholder.
 */

const DEPOSIT_MIN = 0
const DEPOSIT_MAX = 30
const DEPOSIT_STEP = 0.01

const clampDeposit = (value: number) =>
  Math.min(DEPOSIT_MAX, Math.max(DEPOSIT_MIN, value))

type RelTCRFormValues = Omit<TcrState, 'transactions'>
type RelTCRParamsProps = StepProps & FormikProps<RelTCRFormValues>

const RelTCRParams = ({
  handleSubmit,
  formId,
  errors,
  touched,
  values,
  setFieldValue,
  setFieldTouched,
  setTcrState,
  defaultArbLabel,
  defaultArbDataLabel,
  defaultGovernorLabel,
}: RelTCRParamsProps) => {
  const ids = useId()
  const nativeCurrency = useNativeCurrency()
  const [advancedOptions, setAdvancedOptions] = useState(false)
  const [depositText, setDepositText] = useState(
    String(values.relSubmissionBaseDeposit ?? 0),
  )
  const chainId = useUrlChainId()
  const chainProvider = useEthersProvider({ chainId: chainId ?? undefined })
  const [debouncedArbitrator] = useDebounce(values.relArbitratorAddress, 1000)
  const { arbitrator: klerosAddress, policy: policyAddress } =
    (chainId !== null && klerosAddresses[chainId]) || {}
  const { arbitrationCost } = useArbitrationCost({
    address: values.relArbitratorAddress,
    arbitratorExtraData: values.relArbitratorExtraData,
    library: chainProvider,
  })
  const setRelArbitratorExtraData = useCallback(
    (val: string) => setFieldValue('relArbitratorExtraData', val),
    [setFieldValue],
  )

  let isKlerosArbitrator: boolean
  try {
    isKlerosArbitrator =
      getAddress(debouncedArbitrator) === getAddress(klerosAddress ?? '')
  } catch {
    isKlerosArbitrator = false
  }

  // The page owns where the wizard is: the step fields are not synced back.
  useEffect(() => {
    const {
      currStep: _currStep,
      visualStep: _visualStep,
      maxVisualStep: _maxVisualStep,
      ...fields
    } = values
    setTcrState((previousState) => ({
      ...previousState,
      ...fields,
    }))
  }, [values, setTcrState])

  const badgesOn = values.relTcrDisabled === false
  const depositVal = clampDeposit(Number(values.relSubmissionBaseDeposit) || 0)

  const onChangeDepositVal = useCallback(
    (value: number) => {
      if (Number.isNaN(value)) return
      const next = clampDeposit(value)
      setFieldValue('relSubmissionBaseDeposit', next)
      setFieldValue('relRemovalBaseDeposit', next)
      setFieldValue('relRemovalChallengeBaseDeposit', next)
    },
    [setFieldValue],
  )

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <StepBody>
        <StepHeader
          heading="Connect a badges list"
          lede="A second list of other lists: an entry that also appears on one of them shows that list’s badge."
        />

        <SwitchField
          id={`${ids}-enabled`}
          label="Add a badges list"
          help="Deployed with your list, with its own policy and deposits; you can skip it."
          checked={badgesOn}
          onChange={(on) => setFieldValue('relTcrDisabled', !on)}
        />

        {badgesOn && (
          <UploadField
            id={`${ids}-policy`}
            label="Badges listing policy (PDF)"
            help={
              <>
                Which lists count as badges for your entries.{' '}
                <TextLink
                  href={POLICY_EXAMPLE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  See an example policy (PDF)
                </TextLink>
              </>
            }
            kind="pdf"
            role={Roles.Policy}
            value={values.relTcrPrimaryDocument}
            error={errors.relTcrPrimaryDocument}
            showError={!!touched.relTcrPrimaryDocument}
            what="the badges policy"
            onChange={(uri) => {
              setFieldValue('relTcrPrimaryDocument', uri)
              setFieldTouched('relTcrPrimaryDocument', true)
            }}
          />
        )}

        {badgesOn && !advancedOptions && (
          <FormField
            id={`${ids}-deposit`}
            label="Badge deposit"
            help="Locked to connect a badge; removals and removal challenges use the same base."
            error={errors.relSubmissionBaseDeposit as string | undefined}
            showError={!!touched.relSubmissionBaseDeposit}
          >
            {(a11y) => (
              <Stack $gap={8}>
                <Row $gap={14}>
                  <RangeInput
                    type="range"
                    min={DEPOSIT_MIN}
                    max={DEPOSIT_MAX}
                    step={DEPOSIT_STEP}
                    value={depositVal}
                    aria-label="Badges deposit"
                    onChange={(event) => {
                      setDepositText(event.target.value)
                      onChangeDepositVal(Number(event.target.value))
                    }}
                  />
                  <AmountInput
                    {...a11y}
                    type="text"
                    inputMode="decimal"
                    value={depositText}
                    onChange={(event) => {
                      setDepositText(event.target.value)
                      if (event.target.value.trim() !== '')
                        onChangeDepositVal(Number(event.target.value))
                    }}
                    onBlur={() => setDepositText(String(depositVal))}
                  />
                  <Small $muted style={{ minWidth: 32 }}>
                    {nativeCurrency}
                  </Small>
                </Row>
                <SliderEnds>
                  <Small $faint>Lower: more badges</Small>
                  <Small $faint>Higher: stronger protection</Small>
                </SliderEnds>
                <DepositTotalLine
                  who="Connecting a badge"
                  base={values.relSubmissionBaseDeposit}
                  arbitrationCost={arbitrationCost}
                  currency={nativeCurrency}
                />
              </Stack>
            )}
          </FormField>
        )}

        {badgesOn &&
          (isKlerosArbitrator ? (
            <KlerosParams
              arbitratorExtraData={values.relArbitratorExtraData}
              klerosAddress={debouncedArbitrator}
              policyAddress={policyAddress}
              setArbitratorExtraData={setRelArbitratorExtraData}
              library={chainProvider}
            />
          ) : (
            <TextField
              name="relArbitratorExtraData"
              label="Arbitrator extra data"
              placeholder="0x7331deadbeef..."
              mono
              help={`Hex extra data for the arbitrator (ERC 792). Default: ${defaultArbDataLabel ?? 'the chain default'}.`}
            />
          ))}

        {badgesOn && (
          <SwitchField
            id={`${ids}-advanced`}
            label="Advanced options"
            help="Each deposit separately, the challenge period, the governor, the arbitrator and appeal stakes."
            checked={advancedOptions}
            onChange={setAdvancedOptions}
          />
        )}

        {badgesOn && advancedOptions && (
          <Stack $gap={24}>
            <Divider label="Deposits" />
            <FieldGrid>
              <BaseDepositField
                name="relSubmissionBaseDeposit"
                label="Badge deposit"
                help="Locked to connect a badge, paid to a winning challenger."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
              <BaseDepositField
                name="relRemovalBaseDeposit"
                label="Removal deposit"
                help="Locked to remove a badge, paid to a winning challenger."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
              <BaseDepositField
                name="relSubmissionChallengeBaseDeposit"
                label="Badge challenge deposit"
                help="Paid to the submitter if a challenge fails; usually 0."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
              <BaseDepositField
                name="relRemovalChallengeBaseDeposit"
                label="Removal challenge deposit"
                help="Paid to the requester if a removal challenge fails."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
            </FieldGrid>
            <Divider label="Period and roles" />
            <FieldGrid>
              <TextField
                name="relChallengePeriodDuration"
                label="Challenge period"
                placeholder="5"
                numeric
                unit="hours"
                help="How long a connection can be challenged before it is accepted."
              />
            </FieldGrid>
            <TextField
              name="relGovernorAddress"
              label="Governor"
              placeholder="0x7331deadbeef..."
              mono
              help={`Can later change deposits, period, policy and governor. Default: ${defaultGovernorLabel ?? 'the chain default'}.`}
            />
            <TextField
              name="relArbitratorAddress"
              label="Arbitrator"
              placeholder="0x7331deadbeef..."
              mono
              help={`The contract that rules on this list's disputes. Default: ${defaultArbLabel ?? 'the chain default'}.`}
            />
            <Divider label="Appeal stakes" />
            <AppealStakeNote loserName="relLoserStakeMultiplier" />
            <FieldGrid $columns={3}>
              <TextField
                name="relSharedStakeMultiplier"
                label="Shared"
                placeholder="100"
                numeric
                unit="%"
                help="When the last round had no winner."
              />
              <TextField
                name="relWinnerStakeMultiplier"
                label="Winner"
                placeholder="100"
                numeric
                unit="%"
                help="Paid by the previous round’s winner."
              />
              <TextField
                name="relLoserStakeMultiplier"
                label="Loser"
                placeholder="200"
                numeric
                unit="%"
                help="Paid by the previous round’s loser."
              />
            </FieldGrid>
          </Stack>
        )}
      </StepBody>
    </form>
  )
}

export default withFormik<StepProps, RelTCRFormValues>({
  // Only an enabled badges list is validated; a skipped one has nothing to check.
  validationSchema: yup.lazy((values: RelTCRFormValues) =>
    values.relTcrDisabled === false ? relSchema : yup.object(),
  ),
  mapPropsToValues: ({ tcrState }) => {
    const { transactions: _transactions, ...values } = tcrState
    return values
  },
  handleSubmit: (values, { props: { postSubmit, setTcrState } }) => {
    setTcrState((prevState) => ({
      ...prevState,
      relTcrDisabled: values.relTcrDisabled !== false,
    }))
    postSubmit()
  },
})(RelTCRParams)
