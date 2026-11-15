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
import { normalizeDecimalInput } from 'utils/decimal-input'
import { Row, Small, Stack } from 'components/curate/primitives'
import {
  FACTORY_COPY,
  useFailedSubmitFocus,
} from 'components/curate/v2-factory-shell'
import { plainDecimal, typedNumber } from 'pages/factory-permanent/format'
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
import useWalletGovernor from './use-wallet-governor'

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

/** Typed text, read with normalizeDecimalInput, that is an amount: digits and one dot. */
export const readsAsAmount = (normalized: string) =>
  /^\d+(\.\d+)?$/.test(normalized)

/**
 * Where the simple deposit box sits on its slider: the stored amount, the
 * slider's end for one above it (the amount itself is kept, as the advanced
 * fields keep it), 0 while the text is not an amount.
 */
export const sliderDeposit = (stored: unknown) => {
  const amount = typedNumber(stored)
  return clampDeposit(Number.isFinite(amount) ? amount : 0)
}

/** The deposit step's fields that only Advanced options shows. */
const ADVANCED_FIELDS = new Set([
  'removalBaseDeposit',
  'submissionChallengeBaseDeposit',
  'removalChallengeBaseDeposit',
  'challengePeriodDuration',
  'governorAddress',
  'arbitratorAddress',
  'sharedStakeMultiplier',
  'winnerStakeMultiplier',
  'loserStakeMultiplier',
])

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
        = {plainDecimal(base ?? 0)} base deposit + {cost ?? '…'} arbitration
        cost.
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
  // "12,5" reads as 12.5, as the deploy reads it.
  const loser = typedNumber(field.value)
  const valid = Number.isFinite(loser) && loser >= 0
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
  submitCount,
  isSubmitting,
  setFieldValue,
  setFieldTouched,
  setTcrState,
  defaultArbLabel,
  defaultGovernorLabel,
}: TCRParamsProps) => {
  const ids = useId()
  const nativeCurrency = useNativeCurrency()
  const [advancedOptions, setAdvancedOptions] = useState(false)
  // Next checks the fields under Advanced options too: when one of them
  // fails, the section opens so its error shows, and focus moves to it.
  useFailedSubmitFocus({
    formId,
    submitCount,
    isSubmitting,
    errors,
    reveal: (fields) => {
      if (fields.some((field) => ADVANCED_FIELDS.has(field)))
        setAdvancedOptions(true)
    },
  })
  // This form writes every wizard field back, the badges list's governor
  // included, so it fills both.
  useWalletGovernor(values.governorAddress, (address) =>
    setFieldValue('governorAddress', address),
  )
  useWalletGovernor(values.relGovernorAddress, (address) =>
    setFieldValue('relGovernorAddress', address),
  )
  // The typed text while the amount box has focus; the stored value otherwise.
  const [depositDraft, setDepositDraft] = useState<string | null>(null)
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

  const depositVal = sliderDeposit(values.submissionBaseDeposit)
  const depositText = depositDraft ?? plainDecimal(values.submissionBaseDeposit)

  // The simple box stands for three deposits: the submission deposit, the
  // removal deposit and the removal challenge deposit.
  const onChangeDepositVal = useCallback(
    (value: number | string) => {
      setFieldValue('submissionBaseDeposit', value)
      setFieldValue('removalBaseDeposit', value)
      setFieldValue('removalChallengeBaseDeposit', value)
    },
    [setFieldValue],
  )
  // Typed text is kept as typed ("0,5" stored as "0.5"), above the slider's
  // end too, as the advanced fields keep it. Text that is not an amount yet
  // goes to the submission deposit alone, so its error shows under the box
  // while the other two keep the last amount; nothing half-typed is stored
  // as a number.
  const onTypeDeposit = (text: string) => {
    setDepositDraft(text)
    const typed = normalizeDecimalInput(text)
    if (readsAsAmount(typed)) onChangeDepositVal(typed)
    else setFieldValue('submissionBaseDeposit', typed)
  }

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
                      setDepositDraft(null)
                      onChangeDepositVal(
                        clampDeposit(Number(event.target.value)),
                      )
                    }}
                  />
                  <AmountInput
                    {...a11y}
                    type="text"
                    inputMode="decimal"
                    value={depositText}
                    onChange={(event) => onTypeDeposit(event.target.value)}
                    onBlur={() => {
                      setDepositDraft(null)
                      setFieldTouched('submissionBaseDeposit', true)
                    }}
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
              help="Hex extra data passed to the arbitrator with every dispute (ERC 792)."
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
              help={`Can later change every setting, the arbitrator and court included, and set a relayer that adds or removes entries without a challenge. Default: ${defaultGovernorLabel ?? 'the chain default'}.`}
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
  // The deploy step owns the transactions and a sent deployment: a form
  // writing its values back must not restore an old copy of either.
  mapPropsToValues: ({ tcrState }) => {
    const {
      transactions: _transactions,
      pendingDeploy: _pendingDeploy,
      ...values
    } = tcrState
    return values
  },
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  },
})(TCRParams)
