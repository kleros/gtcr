import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import styled from 'styled-components'
import { useField, withFormik, type FormikProps } from 'formik'
import { useDebounce } from 'use-debounce'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useArbitrationCost from 'hooks/arbitration-cost'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import useUrlChainId from 'hooks/use-url-chain-id'
import { klerosAddresses } from 'config/tcr-addresses'
import { NETWORKS_INFO } from 'config/networks'
import {
  Data,
  Label,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  StatusDot,
  truncateMiddle,
} from 'components/curate/primitives'
import { FACTORY_COPY } from 'components/curate/v2-factory-shell'
import KlerosParams from './kleros-params'
import {
  AmountInput,
  Divider,
  ErrorText,
  FieldGrid,
  FormField,
  NarrowOnly,
  Note,
  RangeInput,
  SliderEnds,
  StepBody,
  StepHeader,
  SwitchField,
  TextField,
  TextLink,
  UploadField,
} from './controls'
import {
  EXAMPLE_POLICY_URL,
  LOGO_MAX_MB,
  LOGO_TYPES,
  POLICY_MAX_MB,
  POLICY_TYPE,
  STAKE_SLIDER,
  WIZARD_DEFAULTS,
} from './defaults'
import {
  formatMaybe,
  enforcedStake as enforcedStakeText,
  groupAmount,
  stakeProblem,
  stakeProblemText,
  plainDecimal,
} from './format'
import { tcrSchemaFor, type FactorySection } from './schemas'
import type { StepProps, TcrState } from '.'

/*
 * The list step of the Stake factory, one section per visual step: name,
 * description, logo, policy, the stake token, then the minimum stake with
 * the court (and the advanced periods, roles and multipliers), and the item
 * name. Values sync into the cached wizard state as they change; Next
 * submits the form and only the open section's schema runs.
 */

const { getAddress, isAddress } = ethers.utils

type TCRFormValues = Omit<TcrState, 'transactions'>
type TCRParamsOuterProps = StepProps & {
  factorySection?: FactorySection
  /** Open with the advanced options shown (an Edit from the review). */
  startAdvanced?: boolean
}
type TCRParamsProps = TCRParamsOuterProps & FormikProps<TCRFormValues>

/** The list sections both factories share read the same in each. */
const SECTION_COPY: Record<FactorySection, { heading: string; lede: string }> =
  {
    ...FACTORY_COPY.sections,
    token: {
      heading: 'Choose the stake token',
      lede: 'The ERC-20 every submitter locks while an entry is listed. It cannot be changed after deployment.',
    },
    stake: {
      heading: 'Set the stake and the court',
      lede: 'The stake stays locked while an entry is listed; a successful challenger takes it.',
    },
  }

const rejectLogo = (file: File): string => {
  if (!LOGO_TYPES.has(file.type)) return 'Use a PNG, SVG, WebP or JPEG image.'
  if (file.size / 1024 / 1024 >= LOGO_MAX_MB)
    return `The image must be smaller than ${LOGO_MAX_MB} MB.`
  return ''
}

const rejectPolicy = (file: File): string => {
  if (file.type !== POLICY_TYPE) return 'Upload the policy as a PDF.'
  if (file.size / 1024 / 1024 >= POLICY_MAX_MB)
    return `The file must be smaller than ${POLICY_MAX_MB} MB.`
  return ''
}

/* ---------- Token read-out ---------- */

const TokenCard = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 20px;
  padding: 16px 18px;
  border-radius: var(--radius);
  background: var(--color-raised);

  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const TokenSymbol = styled.span`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 30px;
  line-height: 34px;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
`

const TokenFacts = styled.dl`
  display: flex;
  gap: 20px;
  margin: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  dd {
    margin: 0;
  }
`

/**
 * What the chain says is at the typed address: the ERC-20's symbol and
 * decimals, or why none could be read. Read only; it never blocks Next.
 */
const TokenReadout = ({
  address,
  symbol,
  decimals,
  loading,
}: {
  address: string
  symbol: string
  decimals: number
  loading: boolean
}) => {
  const trimmed = address.trim()
  if (!trimmed) return null
  const valid = isAddress(trimmed)
  const found = valid && !loading && symbol !== 'tokens'
  return (
    <TokenCard role="status" aria-live="polite">
      <Stack $gap={6} style={{ minWidth: 0 }}>
        <Row $gap={8}>
          <StatusDot
            $tone={found ? 'registered' : valid && loading ? 'window' : 'off'}
            aria-hidden
          />
          <Label $tone="muted">
            {!valid
              ? 'Not an address'
              : loading
                ? 'Reading the token'
                : found
                  ? 'ERC-20 found'
                  : 'No ERC-20 read at this address'}
          </Label>
        </Row>
        {valid && loading ? (
          <SkeletonBlock $height="34px" $width="120px" />
        ) : found ? (
          <TokenSymbol>{symbol}</TokenSymbol>
        ) : (
          <Small $muted>
            {valid
              ? 'Check the address and the network: the token must be on this chain.'
              : 'An address is 0x followed by 40 hexadecimal characters.'}
          </Small>
        )}
      </Stack>
      {found && (
        <TokenFacts>
          <div>
            <Label as="dt" $tone="muted">
              Decimals
            </Label>
            <dd>
              <Data>{decimals}</Data>
            </dd>
          </div>
          <div>
            <Label as="dt" $tone="muted">
              Contract
            </Label>
            <dd>
              <Data $mono $muted $weight={400} title={trimmed}>
                {truncateMiddle(trimmed, 6, 4)}
              </Data>
            </dd>
          </div>
        </TokenFacts>
      )}
    </TokenCard>
  )
}

/* ---------- Appeal note ---------- */

const multiple = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** The appeal multipliers in one note, with the example computed from the loser field. */
const AppealStakeNote = () => {
  const [field] = useField<unknown>('loserStakeMultiplier')
  const loser = Number(field.value)
  const valid = field.value !== '' && Number.isFinite(loser) && loser >= 0
  return (
    <Note>
      <Small $muted>
        To appeal, each side pays the next round’s juror fees plus a stake, a
        share of those fees; the losing side’s stake rewards whoever funded the
        winner.
      </Small>
      <Small>
        Total appeal fee for one side = juror fees + juror fees × stake
        multiplier.
        {valid &&
          ` At ${multiple.format(loser)}%, the side the court ruled against pays ${multiple.format(1 + loser / 100)}× the juror fees.`}
      </Small>
    </Note>
  )
}

/* ---------- The step ---------- */

const TCRParams = (props: TCRParamsProps) => {
  const {
    handleSubmit,
    formId,
    factorySection,
    startAdvanced,
    errors,
    touched,
    values,
    setFieldValue,
    setFieldTouched,
    setTcrState,
    defaultArbLabel,
    defaultArbDataLabel,
    defaultGovernorLabel,
    defaultStakeTokenLabel,
  } = props
  const ids = useId()
  const nativeCurrency = useNativeCurrency()
  const { uploadFile } = useAtlasProvider()
  const [uploading, setUploading] = useState<{
    tcrLogo?: boolean
    tcrPrimaryDocument?: boolean
  }>({})
  const [advancedOptions, setAdvancedOptions] = useState(!!startAdvanced)
  // The typed text while the amount box has focus; the stored value otherwise.
  const [depositDraft, setDepositDraft] = useState<string | null>(null)
  const chainId = useUrlChainId()
  const chainName =
    chainId === null
      ? 'this chain'
      : (NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]?.name ??
        `chain ${chainId}`)
  const chainProvider = useEthersProvider({ chainId: chainId ?? undefined })
  const [debouncedArbitrator] = useDebounce(values.arbitratorAddress, 1000)
  const { arbitrator: klerosAddress, policy: policyAddress } =
    (chainId !== null && klerosAddresses[chainId]) || {}
  const { arbitrationCost } = useArbitrationCost({
    address: values.arbitratorAddress,
    arbitratorExtraData: values.arbitratorExtraData,
    library: chainProvider,
  })
  const {
    symbol: tokenSymbol,
    decimals: tokenDecimals,
    decimalsRead,
    loading: loadingSymbol,
  } = useTokenSymbol(values.tokenAddress || undefined)
  const setArbitratorExtraData = useCallback(
    (val: string) => setFieldValue('arbitratorExtraData', val),
    [setFieldValue],
  )

  const isKlerosArbitrator = useMemo(() => {
    try {
      return getAddress(debouncedArbitrator) === getAddress(klerosAddress ?? '')
    } catch {
      return false
    }
  }, [debouncedArbitrator, klerosAddress])

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

  const upload = useCallback(
    async (
      field: 'tcrLogo' | 'tcrPrimaryDocument',
      role: Roles,
      file: File,
    ) => {
      setUploading((previous) => ({ ...previous, [field]: true }))
      try {
        const fileURI = await uploadFile(file, role)
        if (!fileURI) throw new Error('Failed to upload file to IPFS.')
        setFieldValue(field, fileURI)
        setFieldTouched(field, true, false)
        toast.success('File uploaded successfully.')
      } catch (err) {
        console.error(err)
        toast.error('File upload failed.')
      } finally {
        setUploading((previous) => ({ ...previous, [field]: false }))
      }
    },
    [setFieldTouched, setFieldValue, uploadFile],
  )

  // The typed text is stored as typed: a float would round an 18-decimal
  // amount before it is encoded. The slider stores its plain numbers.
  const onChangeDepositVal = useCallback(
    (value: number | string) => {
      if (typeof value === 'number' && Number.isNaN(value)) return
      setFieldValue('submissionMinDeposit', value)
    },
    [setFieldValue],
  )

  const show = (section: FactorySection) =>
    !factorySection || factorySection === section
  const copy = factorySection ? SECTION_COPY[factorySection] : null
  const stored = Number(values.submissionMinDeposit)
  const sliderValue = Number.isFinite(stored)
    ? Math.min(STAKE_SLIDER.max, Math.max(STAKE_SLIDER.min, stored))
    : WIZARD_DEFAULTS.submissionMinDeposit
  const depositText = depositDraft ?? plainDecimal(values.submissionMinDeposit)
  const tokenFound =
    !!values.tokenAddress &&
    !loadingSymbol &&
    tokenSymbol !== 'tokens' &&
    decimalsRead
  const enforcedStake = groupAmount(
    enforcedStakeText(
      values.submissionMinDeposit,
      tokenFound ? tokenDecimals : 18,
    ),
  )
  const costText = formatMaybe(arbitrationCost)
  // The minimum is encoded in the token's base units: it must be a plain
  // number with no more decimal places than the token has, within a uint256.
  // The form's own rules (required, not negative) speak first.
  const problem = tokenFound
    ? stakeProblem(values.submissionMinDeposit, tokenDecimals)
    : null
  const schemaAccepts = (() => {
    try {
      tcrSchemaFor('stake').validateSyncAt('submissionMinDeposit', values)
      return true
    } catch {
      return false
    }
  })()
  const stakeError =
    problem && schemaAccepts
      ? stakeProblemText(problem, tokenSymbol, tokenDecimals)
      : null
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const stakeShown = !factorySection || factorySection === 'stake'
    // Wait for the token's decimals before judging the stake.
    const tokenPending = !!values.tokenAddress && loadingSymbol
    if (stakeShown && (stakeError || tokenPending)) {
      event.preventDefault()
      return
    }
    handleSubmit(event)
  }

  return (
    <form id={formId} noValidate onSubmit={onSubmit}>
      <StepBody>
        <StepHeader
          heading={copy ? copy.heading : 'List parameters'}
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
            help="A square image, ideally with a transparent background."
            hint={`PNG, SVG, WebP or JPEG · under ${LOGO_MAX_MB} MB`}
            kind="image"
            accept={[...LOGO_TYPES].join(',')}
            value={values.tcrLogo}
            uploading={!!uploading.tcrLogo}
            error={errors.tcrLogo}
            showError={!!touched.tcrLogo}
            what="the logo"
            reject={rejectLogo}
            onPick={(file) => upload('tcrLogo', Roles.Logo, file)}
          />
        )}

        {show('policy') && (
          <UploadField
            id={`${ids}-policy`}
            label="Listing policy (PDF)"
            help={
              <>
                The acceptance criteria every submission is judged by.{' '}
                <TextLink
                  href={EXAMPLE_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  See an example policy
                </TextLink>
              </>
            }
            hint={`PDF · under ${POLICY_MAX_MB} MB`}
            kind="pdf"
            accept={POLICY_TYPE}
            value={values.tcrPrimaryDocument}
            uploading={!!uploading.tcrPrimaryDocument}
            error={errors.tcrPrimaryDocument}
            showError={!!touched.tcrPrimaryDocument}
            what="the policy"
            reject={rejectPolicy}
            onPick={(file) => upload('tcrPrimaryDocument', Roles.Policy, file)}
          />
        )}

        {show('token') && (
          <TextField
            name="tokenAddress"
            label="Stake token address"
            mono
            placeholder="0x…"
            help={
              defaultStakeTokenLabel
                ? `Pre-filled with ${defaultStakeTokenLabel} on ${chainName}.`
                : `There is no default on ${chainName}; enter the token's address.`
            }
          />
        )}

        {show('token') && (
          <TokenReadout
            address={values.tokenAddress ?? ''}
            symbol={tokenSymbol}
            decimals={tokenDecimals}
            loading={loadingSymbol}
          />
        )}

        {show('stake') && !advancedOptions && (
          <FormField
            id={`${ids}-stake`}
            label="Minimum stake"
            help="What a submitter locks at least; they may stake more."
            error={errors.submissionMinDeposit as string | undefined}
            showError={!!touched.submissionMinDeposit}
          >
            {(a11y) => (
              <Stack $gap={8}>
                <Row $gap={14}>
                  <RangeInput
                    type="range"
                    aria-label="Minimum stake slider"
                    min={STAKE_SLIDER.min}
                    max={STAKE_SLIDER.max}
                    step={STAKE_SLIDER.step}
                    value={sliderValue}
                    onChange={(event) => {
                      setDepositDraft(null)
                      onChangeDepositVal(Number(event.target.value))
                    }}
                  />
                  <AmountInput
                    {...a11y}
                    type="text"
                    inputMode="decimal"
                    value={depositText}
                    onChange={(event) => {
                      setDepositDraft(event.target.value)
                      if (event.target.value.trim() !== '')
                        onChangeDepositVal(event.target.value.trim())
                    }}
                    onBlur={() => setDepositDraft(null)}
                  />
                  <Small $muted style={{ minWidth: 40 }}>
                    {tokenSymbol}
                  </Small>
                </Row>
                <SliderEnds>
                  <Small $faint>Lower: more submissions</Small>
                  <Small $faint>Higher: wrong entries cost more</Small>
                </SliderEnds>
                {stakeError && <ErrorText role="alert">{stakeError}</ErrorText>}
                <NarrowOnly>
                  <Small $muted>
                    A submitter locks at least{' '}
                    <Small>
                      {enforcedStake ?? '—'} {tokenSymbol}
                    </Small>{' '}
                    and a{' '}
                    <Small>
                      {costText ?? '…'} {nativeCurrency}
                    </Small>{' '}
                    arbitration deposit.
                  </Small>
                </NarrowOnly>
              </Stack>
            )}
          </FormField>
        )}

        {show('stake') &&
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
              placeholder="0x…"
              mono
              help={`Passed to the arbitrator with every dispute (ERC-792). ${defaultArbDataLabel ?? ''}`}
            />
          ))}

        {show('stake') && (
          <SwitchField
            id={`${ids}-advanced`}
            label="Advanced options"
            help="Periods, challenger stake, governor and arbitrator, appeal multipliers."
            checked={advancedOptions}
            onChange={setAdvancedOptions}
          />
        )}

        {show('stake') && advancedOptions && (
          <Stack $gap={24}>
            <Divider label="Stake" />
            <FieldGrid $alignEnd>
              <TextField
                name="submissionMinDeposit"
                label="Minimum submission stake"
                numeric
                unit={tokenSymbol}
                placeholder={String(WIZARD_DEFAULTS.submissionMinDeposit)}
                help="The least a submitter can stake. A successful challenger takes it."
                trailing={
                  stakeError ? (
                    <ErrorText role="alert">{stakeError}</ErrorText>
                  ) : undefined
                }
              />
              <TextField
                name="challengeStakeMultiplier"
                label="Challenger stake"
                numeric
                unit="%"
                placeholder={String(WIZARD_DEFAULTS.challengeStakeMultiplier)}
                help="A share of the entry's stake. Back to the challenger on a win; added to the entry's stake on a loss."
              />
            </FieldGrid>
            <Divider label="Periods" />
            <FieldGrid $alignEnd>
              <TextField
                name="submissionPeriodDuration"
                label="Submission period"
                numeric
                unit="hours"
                placeholder={String(WIZARD_DEFAULTS.submissionPeriodDuration)}
                help="Unchallenged this long, a new entry counts as accepted."
              />
              <TextField
                name="reinclusionPeriodDuration"
                label="Reinclusion period"
                numeric
                unit="hours"
                placeholder={String(WIZARD_DEFAULTS.reinclusionPeriodDuration)}
                help="The same, for an entry the jurors kept."
              />
              <TextField
                name="withdrawingPeriodDuration"
                label="Withdrawing period"
                numeric
                unit="hours"
                placeholder={String(WIZARD_DEFAULTS.withdrawingPeriodDuration)}
                help="From asking to withdraw to getting the stake back."
              />
              <TextField
                name="arbitrationParamsCooldown"
                label="Arbitration parameters cooldown"
                numeric
                unit="hours"
                placeholder={String(WIZARD_DEFAULTS.arbitrationParamsCooldown)}
                help="How long a new policy or arbitration settings wait to apply."
              />
            </FieldGrid>
            <Divider label="Roles" />
            <TextField
              name="governorAddress"
              label="Governor"
              placeholder="0x…"
              mono
              help={`Can change the periods, deposits and policy, and hand the role to another address. Default: ${defaultGovernorLabel ?? 'none'}.`}
            />
            <TextField
              name="arbitratorAddress"
              label="Arbitrator"
              placeholder="0x…"
              mono
              help={`The contract that rules on challenges. Default: ${defaultArbLabel ?? 'none'}; any ERC-792 arbitrator works.`}
            />
            <Divider label="Appeal stakes" />
            <AppealStakeNote />
            <FieldGrid $columns={3} $alignEnd>
              <TextField
                name="sharedStakeMultiplier"
                label="Shared"
                numeric
                unit="%"
                placeholder={String(WIZARD_DEFAULTS.sharedStakeMultiplier)}
                help="Both sides, when the arbitrator refused to rule."
              />
              <TextField
                name="winnerStakeMultiplier"
                label="Winner"
                numeric
                unit="%"
                placeholder={String(WIZARD_DEFAULTS.winnerStakeMultiplier)}
                help="The side the court currently favours."
              />
              <TextField
                name="loserStakeMultiplier"
                label="Loser"
                numeric
                unit="%"
                placeholder={String(WIZARD_DEFAULTS.loserStakeMultiplier)}
                help="The side the court currently rules against."
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
