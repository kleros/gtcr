import React, { useEffect, useState, useCallback, useId } from 'react'
import styled from 'styled-components'
import { withFormik, useField, type FormikProps } from 'formik'
import { useDebounce } from 'use-debounce'
import { ethers, type BigNumber } from 'ethers'
import { Roles } from '@kleros/kleros-app'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useArbitrationCost from 'hooks/arbitration-cost'
import useNativeCurrency from 'hooks/native-currency'
import useUrlChainId from 'hooks/use-url-chain-id'
import { klerosAddresses } from 'config/tcr-addresses'
import { Row, Small, Stack } from 'components/curate/primitives'
import { FACTORY_COPY } from 'components/curate/v2-factory-shell'
import KlerosParams from './kleros-params'
import {
  Divider,
  FieldGrid,
  FormField,
  Input,
  NarrowOnly,
  Note,
  RangeInput,
  StepBody,
  StepHeader,
  SwitchField,
  TextField,
  TextLink,
  UploadField,
  formatNative,
  totalDeposit,
} from './fields'
import { tcrSchemaFor, type FactorySection } from './schemas'
import type { StepProps, TcrState } from '.'

const { getAddress } = ethers.utils

/*
 * Step 1, the list: name, description, logo, policy, deposits (with the
 * court and jurors) and the item name, one section per visual step. Values
 * sync into the cached wizard state as they change; Next submits the form
 * and the section's own schema runs before the wizard advances.
 */

export type { FactorySection } from './schemas'

export const POLICY_EXAMPLE_URL =
  'https://cdn.kleros.link/ipfs/QmUPsjDcKxNv6z6ktnmxkSb4LpqmQ7DT12yG5B73z9uLEy/curated-lists-primary-document.pdf'

/** The list sections both factories share read the same in each. */
const SECTION_COPY: Record<FactorySection, { heading: string; lede: string }> =
  {
    ...FACTORY_COPY.sections,
    deposit: {
      heading: 'Set the deposits and the court',
      lede: 'A submitter’s deposit comes back in full when the entry follows the policy; a challenger who spots one that breaks it earns a bounty.',
    },
  }

export const AmountInput = styled(Input)`
  flex: 0 0 auto;
  width: 104px;
  text-align: right;
  font-family: var(--font-figure);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`

export const SliderEnds = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-right: 164px;

  @media (max-width: 520px) {
    padding-right: 0;
  }
`

const DEPOSIT_MIN = 0
const DEPOSIT_MAX = 30
const DEPOSIT_STEP = 0.01

const clampDeposit = (value: number) =>
  Math.min(DEPOSIT_MAX, Math.max(DEPOSIT_MIN, value))

/* ---------- Shared with the badges step ---------- */

/**
 * The total under a simple deposit slider, for widths where the live
 * preview is not beside the form: "Submitter sends 1.25 xDAI = 0.05 + 1.2".
 */
export const DepositTotalLine = ({
  who,
  base,
  arbitrationCost,
  currency,
}: {
  who: string
  base: unknown
  arbitrationCost?: BigNumber | null
  currency: string
}) => {
  const cost = formatNative(arbitrationCost)
  const total = formatNative(totalDeposit(base, arbitrationCost))
  return (
    <NarrowOnly>
      <Small $muted>
        {who} sends{' '}
        <Small>
          {total ?? '…'} {currency}
        </Small>{' '}
        = {String(base ?? 0)} base deposit + {cost ?? '…'} arbitration cost.
      </Small>
    </NarrowOnly>
  )
}

/** A base deposit input with the total (base + arbitration cost) under it. */
export const BaseDepositField = ({
  name,
  label,
  help,
  arbitrationCost,
  currency,
}: {
  name: string
  label: string
  help: string
  arbitrationCost?: BigNumber | null
  currency: string
}) => {
  const [field] = useField<unknown>(name)
  const total = formatNative(totalDeposit(field.value, arbitrationCost))
  return (
    <TextField
      name={name}
      label={label}
      help={help}
      numeric
      placeholder="0.1"
      unit={currency}
      trailing={
        <Small $faint>
          With the arbitration cost: {total ?? '…'} {currency}
        </Small>
      }
    />
  )
}

const multiple = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * The appeal stake multipliers, explained once for both lists, in the unit
 * the fields take (%). The example is computed from the loser field.
 */
export const AppealStakeNote = ({ loserName }: { loserName: string }) => {
  const [field] = useField<unknown>(loserName)
  const loser = Number(field.value)
  const valid = field.value !== '' && Number.isFinite(loser) && loser >= 0
  return (
    <Note>
      <Small $muted>
        Funding an appeal costs the next round’s juror fees plus a stake, a
        percentage of those fees; the loser’s stake rewards the winner’s
        funders.
      </Small>
      <Small>
        Appeal fee for one side = juror fees × (1 + multiplier ÷ 100).
        {valid &&
          ` At ${multiple.format(loser)}%, the previous round’s loser pays ${multiple.format(1 + loser / 100)}× the juror fees.`}
      </Small>
    </Note>
  )
}

/* ---------- The step ---------- */

type TCRFormValues = Omit<TcrState, 'transactions'>
type TCRParamsOuterProps = StepProps & { factorySection?: FactorySection }
type TCRParamsProps = TCRParamsOuterProps & FormikProps<TCRFormValues>

const TCRParams = ({
  handleSubmit,
  formId,
  factorySection,
  errors,
  touched,
  values,
  setFieldValue,
  setFieldTouched,
  setTcrState,
  defaultArbLabel,
  defaultArbDataLabel,
  defaultGovernorLabel,
}: TCRParamsProps) => {
  const ids = useId()
  const nativeCurrency = useNativeCurrency()
  const [advancedOptions, setAdvancedOptions] = useState(false)
  const [depositText, setDepositText] = useState(
    String(values.submissionBaseDeposit ?? 0),
  )
  const chainId = useUrlChainId()
  const chainProvider = useEthersProvider({ chainId: chainId ?? undefined })
  const [debouncedArbitrator] = useDebounce(values.arbitratorAddress, 1000)
  const { arbitrator: klerosAddress, policy: policyAddress } =
    (chainId !== null && klerosAddresses[chainId]) || {}
  const { arbitrationCost } = useArbitrationCost({
    address: values.arbitratorAddress,
    arbitratorExtraData: values.arbitratorExtraData,
    library: chainProvider,
  })
  const setArbitratorExtraData = useCallback(
    (val: string) => setFieldValue('arbitratorExtraData', val),
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

  const depositVal = clampDeposit(Number(values.submissionBaseDeposit) || 0)

  const onChangeDepositVal = useCallback(
    (value: number) => {
      if (Number.isNaN(value)) return
      const next = clampDeposit(value)
      setFieldValue('submissionBaseDeposit', next)
      setFieldValue('removalBaseDeposit', next)
      setFieldValue('removalChallengeBaseDeposit', next)
    },
    [setFieldValue],
  )

  const show = (section: FactorySection) =>
    !factorySection || factorySection === section
  const copy = factorySection ? SECTION_COPY[factorySection] : null

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <StepBody>
        <StepHeader
          heading={copy ? copy.heading : 'List details'}
          lede={copy?.lede}
        />

        {show('title') && (
          <TextField name="tcrTitle" {...FACTORY_COPY.fields.title} />
        )}

        {show('description') && (
          <TextField
            name="tcrDescription"
            {...FACTORY_COPY.fields.description}
          />
        )}

        {show('logo') && (
          <UploadField
            id={`${ids}-logo`}
            label="List logo"
            help="Square, ideally with a transparent background."
            kind="image"
            role={Roles.Logo}
            value={values.tcrLogo}
            error={errors.tcrLogo}
            showError={!!touched.tcrLogo}
            what="the logo"
            previewAlt="List logo"
            onChange={(uri) => {
              setFieldValue('tcrLogo', uri)
              setFieldTouched('tcrLogo', true)
            }}
          />
        )}

        {show('policy') && (
          <UploadField
            id={`${ids}-policy`}
            label="Listing policy (PDF)"
            help={
              <>
                The rules every entry is judged by.{' '}
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
            value={values.tcrPrimaryDocument}
            error={errors.tcrPrimaryDocument}
            showError={!!touched.tcrPrimaryDocument}
            what="the policy"
            onChange={(uri) => {
              setFieldValue('tcrPrimaryDocument', uri)
              setFieldTouched('tcrPrimaryDocument', true)
            }}
          />
        )}

        {show('deposit') && !advancedOptions && (
          <FormField
            id={`${ids}-deposit`}
            label="Submission deposit"
            help="Removal requests and removal challenges use the same base amount."
            error={errors.submissionBaseDeposit as string | undefined}
            showError={!!touched.submissionBaseDeposit}
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
                    aria-label="Submission deposit"
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
                      const parsed = Number(event.target.value)
                      if (event.target.value.trim() !== '')
                        onChangeDepositVal(parsed)
                    }}
                    onBlur={() => setDepositText(String(depositVal))}
                  />
                  <Small $muted style={{ minWidth: 32 }}>
                    {nativeCurrency}
                  </Small>
                </Row>
                <SliderEnds>
                  <Small $faint>Lower: more submissions</Small>
                  <Small $faint>Higher: stronger protection</Small>
                </SliderEnds>
                <DepositTotalLine
                  who="A submitter"
                  base={values.submissionBaseDeposit}
                  arbitrationCost={arbitrationCost}
                  currency={nativeCurrency}
                />
              </Stack>
            )}
          </FormField>
        )}

        {show('deposit') &&
          (isKlerosArbitrator ? (
            <KlerosParams
              arbitratorExtraData={values.arbitratorExtraData}
              klerosAddress={debouncedArbitrator}
              policyAddress={policyAddress}
              setArbitratorExtraData={setArbitratorExtraData}
              library={chainProvider}
            />
          ) : (
            <TextField
              name="arbitratorExtraData"
              label="Arbitrator extra data"
              placeholder="0x7331deadbeef..."
              mono
              help={`Hex extra data for the arbitrator (ERC 792). Default: ${defaultArbDataLabel ?? 'the chain default'}.`}
            />
          ))}

        {show('deposit') && (
          <SwitchField
            id={`${ids}-advanced`}
            label="Advanced options"
            help="Each deposit separately, the challenge period, the governor, the arbitrator and appeal stakes."
            checked={advancedOptions}
            onChange={setAdvancedOptions}
          />
        )}

        {show('deposit') && advancedOptions && (
          <Stack $gap={24}>
            <Divider label="Deposits" />
            <FieldGrid>
              <BaseDepositField
                name="submissionBaseDeposit"
                label="Submission deposit"
                help="Locked by a submitter, paid to a winning challenger."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
              <BaseDepositField
                name="removalBaseDeposit"
                label="Removal deposit"
                help="Locked to remove an entry, paid to a winning challenger."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
              <BaseDepositField
                name="submissionChallengeBaseDeposit"
                label="Submission challenge deposit"
                help="Paid to the submitter if a challenge fails; usually 0."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
              <BaseDepositField
                name="removalChallengeBaseDeposit"
                label="Removal challenge deposit"
                help="Paid to the requester if a removal challenge fails."
                arbitrationCost={arbitrationCost}
                currency={nativeCurrency}
              />
            </FieldGrid>
            <Divider label="Period and roles" />
            <FieldGrid>
              <TextField
                name="challengePeriodDuration"
                label="Challenge period"
                placeholder="84"
                numeric
                unit="hours"
                help="How long a request can be challenged before it is accepted."
              />
            </FieldGrid>
            <TextField
              name="governorAddress"
              label="Governor"
              placeholder="0x7331deadbeef..."
              mono
              help={`Can later change deposits, period, policy and governor. Default: ${defaultGovernorLabel ?? 'the chain default'}.`}
            />
            <TextField
              name="arbitratorAddress"
              label="Arbitrator"
              placeholder="0x7331deadbeef..."
              mono
              help={`The ERC 792 contract that rules on disputes. Default: ${defaultArbLabel ?? 'the chain default'}.`}
            />
            <Divider label="Appeal stakes" />
            <AppealStakeNote loserName="loserStakeMultiplier" />
            <FieldGrid $columns={3}>
              <TextField
                name="sharedStakeMultiplier"
                label="Shared"
                placeholder="100"
                numeric
                unit="%"
                help="When the last round had no winner."
              />
              <TextField
                name="winnerStakeMultiplier"
                label="Winner"
                placeholder="100"
                numeric
                unit="%"
                help="Paid by the previous round’s winner."
              />
              <TextField
                name="loserStakeMultiplier"
                label="Loser"
                placeholder="200"
                numeric
                unit="%"
                help="Paid by the previous round’s loser."
              />
            </FieldGrid>
          </Stack>
        )}

        {show('custom') && (
          <FieldGrid>
            <TextField name="itemName" {...FACTORY_COPY.fields.itemName} />
            <TextField
              name="itemNamePlural"
              {...FACTORY_COPY.fields.itemNamePlural}
            />
          </FieldGrid>
        )}
      </StepBody>
    </form>
  )
}

export default withFormik<TCRParamsOuterProps, TCRFormValues>({
  validationSchema: ({ factorySection }: TCRParamsOuterProps) =>
    tcrSchemaFor(factorySection),
  mapPropsToValues: ({ tcrState }) => {
    const { transactions: _transactions, ...values } = tcrState
    return values
  },
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  },
})(TCRParams)
