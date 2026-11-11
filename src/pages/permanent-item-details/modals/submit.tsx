import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { ethers } from 'ethers'
import { withFormik, type FormikProps } from 'formik'
import { useAccount, usePublicClient } from 'wagmi'
import { simulateContract, writeContract } from '@wagmi/core'
import { erc20Abi, type Abi } from 'viem'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { Form } from 'components/ui'
import InputSelector from 'components/input-selector'
import ListingCriteriaLink from 'components/listing-criteria-link'
import useFactory from 'hooks/factory'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import { resolveStashedFiles } from 'utils/resolve-stashed-files'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { addPeriod, capitalizeFirstLetter } from 'utils/string'
import { formatDurationLong } from 'utils/time'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { useTxChainId } from 'pages/submit-item/use-wallet-gate'
import { itemIdFromReceipt } from 'pages/submit-item/use-submit-actions'
import { buildInitialValues } from 'pages/submit-item/form'
import {
  Body,
  Button,
  Label,
  Row,
  Small,
  Stack,
  TextInput,
} from 'components/curate/primitives'
import { WhatHappensNext } from 'components/curate/what-happens-next'
import {
  DialogColumns,
  FormBlock,
  GateHelper,
  ModalShell,
  ModalSkeleton,
  PolicyText,
  StepRow,
  applyMultiplier,
  multiplierPercent,
  nativeText,
  tokenText,
  useActionGate,
} from './shell'

/*
 * Submit (or resubmit) an item to a Stake Curate list. Two assets leave the
 * wallet: an ERC20 stake of at least the list minimum (approve first, stake
 * more if you want) and the native arbitration deposit. The form, its
 * validation and the uploads are the same plumbing the list page relies on.
 */

export const SUBMISSION_FORM_ID = 'submitItemForm'

/** A field value is a string, or a File while an upload is stashed. */
type SubmissionFormValues = Record<string, string | File>

/**
 * The form's key for a column. Formik reads a field name as a path, so a
 * label such as "No. of tokens" would be stored as {No: {" of tokens": …}}
 * while the submission reads the label itself, and the input selector reads
 * some values by name directly. Each column is keyed by its position; the
 * values go back under their labels before anything is uploaded.
 */
const fieldName = (index: number) => `column${index}`

type RegistryExistsCheck = (tcrAddress: string) => Promise<boolean>

interface SubmissionFormOuterProps {
  columns: Column[]
  initialValues?: unknown[]
  /**
   * Only the confirm may submit: Enter in a field submits a one-field form
   * implicitly, and that must not skip the required fields, the stake and
   * balance checks or the wallet gate.
   */
  canSubmit?: boolean
  disabledFields: boolean[]
  postSubmit: (
    values: SubmissionFormValues,
    columns: Column[],
    resetForm: (nextState?: Record<string, unknown>) => void,
    setFieldValue: (
      field: string,
      value: unknown,
      shouldValidate?: boolean,
    ) => void,
  ) => void
  deployedWithFactory: RegistryExistsCheck
  deployedWithLightFactory: RegistryExistsCheck
  deployedWithPermanentFactory: RegistryExistsCheck
  onFieldsComplete?: (complete: boolean) => void
  style?: React.CSSProperties
}

const FieldLabel = styled.span`
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
`

const _SubmissionForm: React.FC<
  SubmissionFormOuterProps & FormikProps<SubmissionFormValues>
> = (p) => {
  useEffect(() => {
    if (!p.onFieldsComplete || !p.columns) return
    const allFilled = p.columns.every((column, index) => {
      if (column.type === ItemTypes.BOOLEAN) return true
      if (column.optional) return true
      const value = p.values[fieldName(index)]
      return value !== undefined && value !== '' && String(value).trim() !== ''
    })
    p.onFieldsComplete(allFilled)
  }, [p])

  return (
    <Form
      onSubmit={(event) => {
        if (!p.canSubmit) {
          event.preventDefault()
          return
        }
        p.handleSubmit(event)
      }}
      id={SUBMISSION_FORM_ID}
    >
      {p.columns &&
        p.columns.length > 0 &&
        p.columns.map((column, index) => (
          <InputSelector
            style={p.style}
            type={column.type}
            name={fieldName(index)}
            allowedFileTypes={column.allowedFileTypes}
            key={index}
            values={p.values}
            error={p.errors[fieldName(index)]}
            setFieldValue={p.setFieldValue}
            disabled={p.disabledFields && p.disabledFields[index]}
            touched={p.touched[fieldName(index)]}
            label={
              <FieldLabel>
                <span>
                  {column.label}
                  {column.optional ? '' : ' *'}
                </span>
                {column.description && (
                  <Small $muted>{addPeriod(column.description)}</Small>
                )}
              </FieldLabel>
            }
          />
        ))}
    </Form>
  )
}

const SubmissionForm = withFormik<
  SubmissionFormOuterProps,
  SubmissionFormValues
>({
  mapPropsToValues: ({ columns, initialValues }) => {
    // The submit page's defaults: a value the entry lacks starts as the
    // column's default, never as the text "undefined".
    const values = buildInitialValues(columns, initialValues)
    return Object.fromEntries(
      columns.map((column, index) => [fieldName(index), values[column.label]]),
    )
  },
  handleSubmit: (values, { props, resetForm, setFieldValue }) => {
    const { columns } = props
    const byLabel = Object.fromEntries(
      columns.map((column, index) => [column.label, values[fieldName(index)]]),
    )
    // The uploads come back by label: stored under the column's own key.
    props.postSubmit(byLabel, columns, resetForm, (label, value, validate) => {
      const index = columns.findIndex((column) => column.label === label)
      if (index >= 0) setFieldValue(fieldName(index), value, validate)
    })
  },
  validate: async (
    values,
    {
      columns,
      deployedWithFactory,
      deployedWithLightFactory,
      deployedWithPermanentFactory,
    },
  ) => {
    const errors = (
      await Promise.all(
        columns
          .map((column, index) => ({
            type: column.type,
            name: fieldName(index),
          }))
          .filter(({ type }) => type === ItemTypes.GTCR_ADDRESS)
          .map(async ({ name }) => {
            const value = values[name]
            // A GTCR address column always holds a string; a stashed File
            // is never a registry address, so it reads as "not deployed".
            const address = typeof value === 'string' ? value : ''
            return {
              isEmpty: !value,
              wasDeployedWithFactory:
                !!value &&
                ((await deployedWithFactory(address)) ||
                  (await deployedWithLightFactory(address)) ||
                  (await deployedWithPermanentFactory(address))),
              name,
            }
          }),
      )
    )
      .filter(
        (res: {
          wasDeployedWithFactory: boolean
          isEmpty: boolean
          name: string
        }) => !res.wasDeployedWithFactory || res.isEmpty,
      )
      .reduce(
        (
          acc: Record<string, string>,
          curr: {
            wasDeployedWithFactory: boolean
            isEmpty: boolean
            name: string
          },
        ) => ({
          ...acc,
          [curr.name]: curr.isEmpty
            ? `Enter a list address to proceed.`
            : `This address was not deployed with the list creator.`,
        }),
        {},
      )
    // Formik 2 applies returned errors; a thrown object is treated as a crash.
    return errors as Record<string, string>
  },
})(_SubmissionForm)

const StakeField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
`

/* The amount in the field, the token as a suffix inside it. */
const StakeInput = styled.div`
  position: relative;

  input {
    padding-right: 72px;
    font-variant-numeric: tabular-nums;
  }

  span {
    position: absolute;
    top: 50%;
    right: 14px;
    color: var(--color-faint);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    transform: translateY(-50%);
    pointer-events: none;
  }
`

const SubmitModal: React.FC<{
  onCancel: () => void
  visible?: boolean
  title?: React.ReactNode
  tcrAddress?: string
  tokenAddress?: string
  initialValues?: unknown[]
  submissionDeposit?: { toString: () => string }
  metadata?: SubgraphArbitrationSettingMetadata
  columns?: Column[]
  disabledFields?: boolean[]
  submissionPeriod?: string | number
  withdrawingPeriod?: string | number
  arbitrationCost?: { toString: () => string }
  /** Share of the stake a challenger must match, in basis points. */
  challengeStakeMultiplier?: string | number
  embedded?: boolean
  /** Called with the confirmed entry's ID (see useOpenResubmitted). */
  onSubmitted?: (itemID?: string) => void
}> = (props) => {
  const {
    onCancel,
    visible = false,
    title,
    initialValues,
    submissionDeposit,
    tcrAddress,
    tokenAddress,
    metadata,
    disabledFields,
    submissionPeriod,
    withdrawingPeriod,
    arbitrationCost,
    challengeStakeMultiplier,
    columns,
    embedded = false,
    onSubmitted,
  } = props

  const nativeCurrency = useNativeCurrency()
  const {
    deployedWithFactory,
    deployedWithLightFactory,
    deployedWithPermanentFactory,
  } = useFactory()
  const { address: account } = useAccount()
  const chainId = useTxChainId()
  const publicClient = usePublicClient()
  const { uploadFile } = useAtlasProvider()
  const gate = useActionGate('submit', { needsSignIn: true })

  const [balance, setBalance] = useState(0n)
  const [allowance, setAllowance] = useState(0n)
  const [nativeBalance, setNativeBalance] = useState<bigint>()
  const [checkingToken, setCheckingToken] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldsComplete, setFieldsComplete] = useState(false)
  const [stakeInput, setStakeInput] = useState('')
  const [stakeTouched, setStakeTouched] = useState(false)
  const {
    symbol: tokenSymbol,
    decimals: tokenDecimals,
    decimalsRead,
    loading: tokenLoading,
  } = useTokenSymbol(tokenAddress)
  // The stake is parsed in the token's base units: never on a guessed 18.
  const decimalsMissing = !tokenLoading && !!tokenAddress && !decimalsRead

  const { itemName, title: tcrTitle, policyURI } = metadata || {}
  const name = itemName || 'item'

  const minDeposit = useMemo(
    () => (submissionDeposit ? BigInt(submissionDeposit.toString()) : 0n),
    [submissionDeposit],
  )
  const arbitrationWei = useMemo(
    () => BigInt((arbitrationCost || 0).toString()),
    [arbitrationCost],
  )

  // The stake defaults to the list minimum once the token's decimals are known.
  useEffect(() => {
    if (tokenLoading || stakeTouched || minDeposit === 0n) return
    setStakeInput(
      ethers.utils.formatUnits(minDeposit.toString(), tokenDecimals),
    )
  }, [tokenLoading, tokenDecimals, minDeposit, stakeTouched])

  const { depositWei, stakeError } = useMemo(() => {
    if (!stakeInput.trim()) return { depositWei: minDeposit }
    try {
      const parsed = BigInt(
        ethers.utils.parseUnits(stakeInput.trim(), tokenDecimals).toString(),
      )
      if (parsed < minDeposit)
        return {
          depositWei: minDeposit,
          stakeError: `At least ${tokenText(minDeposit, tokenDecimals, tokenSymbol)}`,
        }
      return { depositWei: parsed }
    } catch {
      return { depositWei: minDeposit, stakeError: 'Enter a number' }
    }
  }, [stakeInput, tokenDecimals, minDeposit, tokenSymbol])

  const checkTokenStatus = useCallback(async () => {
    if (!account || !publicClient || !tokenAddress) return

    setCheckingToken(true)
    try {
      const [bal, allow, nativeBal] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, tcrAddress as `0x${string}`],
        }),
        publicClient.getBalance({ address: account }),
      ])
      setBalance(bal)
      setAllowance(allow)
      setNativeBalance(nativeBal)
    } catch (err) {
      console.error('Error checking token status:', err)
    }
    setCheckingToken(false)
  }, [account, publicClient, tokenAddress, tcrAddress])

  useEffect(() => {
    checkTokenStatus()
  }, [checkTokenStatus])

  // Reset loading states when the modal unmounts.
  useEffect(
    () => () => {
      setIsApproving(false)
      setIsSubmitting(false)
    },
    [],
  )

  const hasEnoughBalance = balance >= depositWei
  const hasEnoughAllowance = allowance >= depositWei
  const hasEnoughNativeBalance =
    nativeBalance !== undefined && nativeBalance >= arbitrationWei

  // The first blocker wins; the approve step is its own button above the confirm.
  const blocker = !gate.ready
    ? gate.blocker
    : !arbitrationCost
      ? 'Loading the arbitration deposit'
      : checkingToken || tokenLoading
        ? 'Checking balances'
        : decimalsMissing
          ? `Could not read how many decimals ${tokenSymbol} has; try again later`
          : stakeError
            ? stakeError
            : !fieldsComplete
              ? 'Fill in every required field'
              : !hasEnoughBalance
                ? `Not enough ${tokenSymbol}: you hold ${tokenText(balance, tokenDecimals, tokenSymbol)}`
                : !hasEnoughNativeBalance
                  ? `Not enough ${nativeCurrency} for the arbitration deposit`
                  : !hasEnoughAllowance
                    ? `Approve ${tokenSymbol} first`
                    : undefined
  // Enter in a one-field form submits it implicitly: it may only go through
  // when the confirm button itself could.
  const submitAllowed = !blocker && !isSubmitting

  const handleApprove = useCallback(async () => {
    if (!submissionDeposit || !publicClient) return
    setIsApproving(true)
    try {
      // Simulated on the list's chain; writeContract refuses to send while
      // the wallet is on another one.
      const { request } = await simulateContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [tcrAddress as `0x${string}`, depositWei],
        account,
        chainId,
      })

      const result = await wrapWithToast(
        () => writeContract(wagmiConfig, request),
        publicClient,
      )

      if (result.status) {
        await checkTokenStatus()
        setTimeout(async () => {
          await checkTokenStatus()
        }, 5000)
      }
    } catch (err) {
      console.error('Error approving token:', err)
      errorToast(parseWagmiError(err))
    }
    setIsApproving(false)
  }, [
    tokenAddress,
    tcrAddress,
    submissionDeposit,
    depositWei,
    checkTokenStatus,
    account,
    chainId,
    publicClient,
  ])

  const postSubmit = useCallback(
    async (
      values: Record<string, string | File>,
      columns: Column[],
      resetForm: (nextState?: Record<string, unknown>) => void,
      setFieldValue: (
        field: string,
        value: unknown,
        shouldValidate?: boolean,
      ) => void,
    ) => {
      if (!submitAllowed || !submissionDeposit || !publicClient) return
      setIsSubmitting(true)
      try {
        const resolvedValues = await resolveStashedFiles({
          columns,
          values,
          uploadFile,
          setFieldValue,
        })

        const itemFile = new File(
          [JSON.stringify({ columns, values: resolvedValues })],
          'item.json',
          { type: 'application/json' },
        )
        const ipfsEvidencePath = await uploadFile(itemFile, JSON_UPLOAD_ROLE)
        if (!ipfsEvidencePath)
          throw new Error('Failed to upload item metadata to IPFS.')

        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress as `0x${string}`,
          abi: _gtcr,
          functionName: 'addItem',
          args: [ipfsEvidencePath, depositWei],
          value: arbitrationWei,
          account,
          chainId,
        })

        const result = await wrapWithToast(
          () => writeContract(wagmiConfig, request),
          publicClient,
        )

        if (result.status) {
          onCancel()
          resetForm({})
          onSubmitted?.(
            itemIdFromReceipt(result.result, tcrAddress ?? '', _gtcr as Abi),
          )
        }
      } catch (err) {
        console.error('Error submitting item:', err)
        errorToast(parseWagmiError(err))
      }
      setIsSubmitting(false)
    },
    [
      onCancel,
      onSubmitted,
      submissionDeposit,
      submitAllowed,
      tcrAddress,
      depositWei,
      arbitrationWei,
      account,
      chainId,
      publicClient,
      uploadFile,
    ],
  )

  const close = () => {
    setIsApproving(false)
    setIsSubmitting(false)
    onCancel()
  }

  const confirm = () => {
    const form = document.querySelector<HTMLFormElement>(
      `#${SUBMISSION_FORM_ID}`,
    )
    form?.requestSubmit()
  }

  const stakeText = tokenText(depositWei, tokenDecimals, tokenSymbol)
  const minText = tokenText(minDeposit, tokenDecimals, tokenSymbol)
  const depositText = nativeText(arbitrationWei, nativeCurrency)
  const multiplierKnown =
    challengeStakeMultiplier !== undefined && challengeStakeMultiplier !== null
  const challengerStake = applyMultiplier(depositWei, challengeStakeMultiplier)
  const challengerText = multiplierKnown
    ? tokenText(challengerStake, tokenDecimals, tokenSymbol)
    : 'a share of your stake set by the list'
  // A period of "0" is a real value: the list accepts at once.
  const submissionSeconds = Number(submissionPeriod ?? Number.NaN)
  const submissionWindow =
    submissionSeconds > 0 ? formatDurationLong(submissionSeconds) : undefined
  const acceptsAtOnce = submissionSeconds === 0
  const withdrawingSeconds = Number(withdrawingPeriod ?? Number.NaN)
  const withdrawingWindow =
    withdrawingSeconds > 0 ? formatDurationLong(withdrawingSeconds) : undefined

  const showApprove =
    gate.ready &&
    !checkingToken &&
    !tokenLoading &&
    !decimalsMissing &&
    !stakeError &&
    hasEnoughBalance &&
    !hasEnoughAllowance

  const form = (
    <Stack $gap={16}>
      <Body $muted>
        {tcrTitle ? `Add a ${name} to ${tcrTitle}. ` : `Add a ${name}. `}
        Every field becomes part of the public entry.
        {policyURI && (
          <>
            {' '}
            <ListingCriteriaLink fileURI={policyURI}>
              <PolicyText as="span">Read the listing policy.</PolicyText>
            </ListingCriteriaLink>
          </>
        )}
      </Body>

      <FormBlock>
        <SubmissionForm
          columns={columns ?? []}
          canSubmit={submitAllowed}
          postSubmit={postSubmit}
          initialValues={initialValues}
          disabledFields={disabledFields ?? []}
          deployedWithFactory={deployedWithFactory}
          deployedWithLightFactory={deployedWithLightFactory}
          deployedWithPermanentFactory={deployedWithPermanentFactory}
          onFieldsComplete={setFieldsComplete}
        />
      </FormBlock>

      <StakeField>
        <Label>Token stake</Label>
        <StakeInput>
          <TextInput
            type="text"
            inputMode="decimal"
            value={stakeInput}
            onChange={(event) => {
              setStakeTouched(true)
              setStakeInput(event.target.value)
            }}
            aria-invalid={Boolean(stakeError)}
            aria-describedby="stake-help"
          />
          <span aria-hidden>{tokenSymbol}</span>
        </StakeInput>
        <Small $muted id="stake-help">
          {stakeError
            ? stakeError
            : multiplierKnown
              ? `Minimum ${minText}. A bigger stake makes a challenge dearer: a challenger matches ${multiplierPercent(challengeStakeMultiplier)} of it.`
              : `Minimum ${minText}. A bigger stake makes a challenge dearer.`}
        </Small>
      </StakeField>
    </Stack>
  )

  const receiptColumn = (
    <Stack $gap={12}>
      {showApprove && (
        <StepRow>
          <Small>
            Step 1 of 2 · Allow the list to lock your {tokenSymbol} stake. One
            transaction, then the submission.
          </Small>
          <Button
            type="button"
            $variant="primary"
            $size="sm"
            $block
            disabled={isApproving}
            onClick={handleApprove}
          >
            {isApproving ? 'Waiting for your wallet…' : `Approve ${stakeText}`}
          </Button>
        </StepRow>
      )}
      {gate.ready && hasEnoughAllowance && (
        <Small $muted role="status">
          {tokenSymbol} approved. Step 2 of 2 stakes it and sends the
          arbitration deposit.
        </Small>
      )}

      <WhatHappensNext
        receipt={[
          { label: `Token stake (minimum ${minText})`, value: stakeText },
          { label: 'Arbitration deposit', value: depositText },
        ]}
        total={`${stakeText} + ${depositText}`}
        steps={[
          {
            title: 'You stake and deposit',
            body: `${stakeText} and ${depositText} leave your wallet in one transaction, locked while the ${name} is listed.`,
          },
          {
            title: acceptsAtOnce
              ? 'Accepted at once'
              : submissionWindow
                ? `Submission period of ${submissionWindow}`
                : 'Submission period',
            body: acceptsAtOnce
              ? `This list has no submission period: the ${name} is accepted on submission. It stays open to challenges while listed.`
              : `If it follows the listing policy, the ${name} is accepted${submissionWindow ? ` after ${submissionWindow}` : ' when the period ends'}. It stays open to challenges while listed.`,
          },
          {
            title: 'Withdraw whenever you want',
            body: `Start a withdrawal${withdrawingWindow ? `, wait ${withdrawingWindow}` : ''}, then execute it. ${stakeText} and ${depositText} come back in full.`,
          },
          {
            title: 'If someone challenges: jurors decide',
            branch: true,
            body: `The challenger stakes ${challengerText} and pays the arbitration cost. If your ${name} follows the listing policy and jurors agree, it stays listed and your stake grows by the challenger's${multiplierKnown ? ` (${challengerText})` : ''}, all of it yours when you withdraw. The bounty for a ${name} that breaks the policy is its whole stake. If the jurors refuse to rule, both stakes come back, the arbitration deposit is split, and the ${name} is withdrawn.`,
          },
        ]}
        confirmLabel={typeof title === 'string' ? title : `Submit ${name}`}
        onConfirm={confirm}
        confirmDisabled={Boolean(blocker)}
        confirmBlocker={blocker}
        loading={isSubmitting}
        policy={
          policyURI ? (
            <>
              Jurors decide against the{' '}
              <ListingCriteriaLink fileURI={policyURI}>
                <PolicyText as="span">listing policy</PolicyText>
              </ListingCriteriaLink>
              .
            </>
          ) : undefined
        }
      />
      <GateHelper gate={gate} caption={false} />
    </Stack>
  )

  const content =
    !metadata || !submissionDeposit ? (
      <ModalSkeleton />
    ) : (
      <DialogColumns>
        {form}
        {receiptColumn}
      </DialogColumns>
    )

  if (embedded)
    return (
      <Stack $gap={16}>
        {content}
        <Row>
          <Button type="button" $variant="secondary" onClick={close}>
            Back
          </Button>
        </Row>
      </Stack>
    )

  return (
    <ModalShell
      open={visible}
      title={title ?? `Submit ${capitalizeFirstLetter(name)}`}
      eyebrow={tcrTitle}
      onClose={close}
      width="lg"
    >
      {content}
    </ModalShell>
  )
}

export default SubmitModal
