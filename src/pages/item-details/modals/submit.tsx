import React, { useCallback, useContext, useEffect, useState } from 'react'
import styled from 'styled-components'
import type { BigNumber } from 'ethers'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { useAccount, usePublicClient } from 'wagmi'
import { simulateContract, writeContract } from '@wagmi/core'
import type { Abi } from 'viem'
import { withFormik, type FormikProps } from 'formik'
import { gtcrEncode, ItemTypes, typeDefaultValues } from '@kleros/gtcr-encoder'
import { useAtlasProvider } from '@kleros/kleros-app'
import InputSelector from 'components/input-selector'
import useFactory from 'hooks/factory'
import { resolveStashedFiles } from 'utils/resolve-stashed-files'
import { addPeriod, capitalizeFirstLetter } from 'utils/string'
import useNativeCurrency from 'hooks/native-currency'
import { formatDurationLong } from 'utils/time'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { TCRViewContext } from 'contexts/tcr-view-context'
import { CurateIcon } from 'components/curate/icons'
import {
  Body,
  Button,
  KeyValueList,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  Subheading,
} from 'components/curate/primitives'
import {
  WhatHappensNext,
  type OutcomeStep,
  type ReceiptLine,
} from 'components/curate/what-happens-next'
import { Dialog } from 'components/curate/item-light-dialog'
import { FieldError } from 'components/curate/item-light-notice'
import { useActionGate } from 'components/curate/item-light-gate'
import { formatAmount } from 'components/curate/item-light-format'
import {
  addressErrorsByKey,
  fieldName,
  SubmissionFlowScaffold,
  SubmissionNavigation,
  valuesByLabel,
} from 'pages/light-item-details/modals/submit'
import { PolicyButton } from 'pages/light-item-details/policy-button'
import { encoderValues, integerProblem } from 'pages/submit-item/form'
import { useTxChainId } from 'pages/submit-item/use-wallet-gate'
import { itemIdFromReceipt } from 'pages/submit-item/use-submit-actions'

/*
 * Submit an entry to a Classic Curate list in three steps: fill in the
 * fields, read the policy, review and confirm. The confirm step is the "What
 * happens next" panel with the exact deposit, its breakdown and the
 * challenge period. Files are uploaded through Atlas, the fields are
 * encoded on chain with gtcrEncode, then addItem is sent with the deposit.
 * Mounted by the Classic registry page, the item page (resubmit) and the
 * badge flow.
 */

const SUBMISSION_FORM_ID = 'submitClassicItemForm'

/** A field value is a string, or a File while an upload is stashed. */
type SubmissionFormValues = Record<string, string | File>

type RegistryExistsCheck = (tcrAddress: string) => Promise<boolean>

type SubmissionStage = 'field' | 'policy' | 'preview'

interface SubmissionFormOuterProps {
  columns: Column[]
  initialValues?: unknown[]
  activeStage?: SubmissionStage
  /**
   * Only the review step's confirm may submit: Enter in a field submits a
   * one-field form implicitly, and that must not skip the review, the
   * required fields or the wallet checks.
   */
  canSubmit?: boolean
  disabledFields: boolean[]
  fileURI?: string
  /** The list submitted to, whose policy the policy step opens. */
  tcrAddress?: string
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

const PreviewList = styled(KeyValueList)`
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    gap: 2px;

    dt {
      margin-top: 10px;
    }

    dt:first-child {
      margin-top: 0;
    }
  }
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

  const activeStage = p.activeStage || 'field'

  return (
    <form
      onSubmit={(event) => {
        if (!p.canSubmit) {
          event.preventDefault()
          return
        }
        p.handleSubmit(event)
      }}
      id={SUBMISSION_FORM_ID}
      noValidate
    >
      {activeStage === 'field' && (
        <Stack $gap={16}>
          {p.columns.map((column, index) => (
            <InputSelector
              key={column.label}
              style={p.style}
              type={column.type}
              name={fieldName(index)}
              allowedFileTypes={column.allowedFileTypes}
              values={p.values}
              error={p.errors[fieldName(index)]}
              setFieldValue={p.setFieldValue}
              disabled={p.disabledFields && p.disabledFields[index]}
              touched={p.touched[fieldName(index)]}
              label={
                <span>
                  {column.label}
                  {column.description && (
                    <Small $muted> · {addPeriod(column.description)}</Small>
                  )}
                </span>
              }
            />
          ))}
        </Stack>
      )}
      {activeStage === 'policy' && (
        <Stack $gap={12}>
          <Subheading>Read the listing policy</Subheading>
          <Body>
            Kleros jurors rule on this policy if an entry is challenged.
          </Body>
          <div>
            <PolicyButton
              fileURI={p.fileURI}
              tcrAddress={p.tcrAddress}
              variant="secondary"
              size="md"
            >
              <CurateIcon name="policy" size={16} />
              Open the listing policy
            </PolicyButton>
          </div>
        </Stack>
      )}
      {activeStage === 'preview' && (
        <Stack $gap={12}>
          <Subheading>Review the submission</Subheading>
          <PreviewList>
            {p.columns.map((column, index) => {
              const value = p.values[fieldName(index)]
              const displayValue =
                value instanceof File
                  ? value.name
                  : value === undefined || value === ''
                    ? undefined
                    : String(value)

              // The fields are not on screen here, so a value that fails
              // validation says so next to its review line.
              const error = p.errors[fieldName(index)]

              return (
                <React.Fragment key={column.label}>
                  <dt>{column.label}</dt>
                  <dd>
                    {displayValue ?? <Small $faint>Not provided</Small>}
                    {error && (
                      <FieldError role="alert">
                        {String(error)} Go back to the fields to fix it.
                      </FieldError>
                    )}
                  </dd>
                </React.Fragment>
              )
            })}
          </PreviewList>
        </Stack>
      )}
    </form>
  )
}

const SubmissionForm = withFormik<
  SubmissionFormOuterProps,
  SubmissionFormValues
>({
  mapPropsToValues: ({ columns, initialValues }) =>
    columns.reduce((acc: Record<string, string>, curr: Column, i: number) => {
      // An empty initialValues array (e.g. ?action=submit) must not
      // pre-fill every field with "undefined".
      const initial = initialValues?.[i]
      const defaultValue =
        initial !== undefined && initial !== null
          ? initial
          : curr.type === 'number'
            ? ''
            : typeDefaultValues[curr.type]

      return {
        ...acc,
        [fieldName(i)]: String(defaultValue),
      }
    }, {}),
  handleSubmit: (values, { props, resetForm, setFieldValue }) => {
    const { columns } = props
    // The submission reads the values by label; an upload comes back by
    // label and is stored under the column's own key.
    props.postSubmit(
      valuesByLabel(columns, values),
      columns,
      resetForm,
      (label, value, validate) => {
        const index = columns.findIndex((column) => column.label === label)
        if (index >= 0) void setFieldValue(fieldName(index), value, validate)
      },
    )
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
    // A Classic list stores number and Twitter user columns as integers:
    // gtcrEncode throws on anything else, after the files were uploaded.
    // The form refuses such a value first. An empty one is left to the
    // required-field check.
    const integerErrors = Object.fromEntries(
      columns.flatMap((column, index) => {
        if (
          column.type !== ItemTypes.NUMBER &&
          column.type !== ItemTypes.TWITTER_USER_ID
        )
          return []
        const value = values[fieldName(index)]
        if (typeof value !== 'string' || !value.trim()) return []
        const problem = integerProblem(value)
        return problem ? [[fieldName(index), problem]] : []
      }),
    )
    // Formik 2 applies returned errors; a thrown object is treated as a crash.
    return {
      ...integerErrors,
      ...addressErrorsByKey(columns, values),
      ...(errors as Record<string, string>),
    }
  },
})(_SubmissionForm)

const SubmitModal: React.FC<{
  onCancel: () => void
  visible?: boolean
  title?: React.ReactNode
  tcrAddress?: string
  initialValues?: unknown[]
  submissionDeposit?: BigNumber
  /** Optional breakdown; read from the list context when it is the same list. */
  baseDeposit?: BigNumber
  arbitrationCost?: BigNumber
  metaEvidence?: MetaEvidence
  disabledFields?: boolean[]
  challengePeriodDuration?: BigNumber
  embedded?: boolean
  /** Called with the confirmed entry's ID (see useOpenResubmitted). */
  onSubmitted?: (itemID?: string) => void
}> = (props) => {
  const {
    onCancel,
    visible,
    title,
    initialValues,
    submissionDeposit,
    tcrAddress,
    metaEvidence,
    disabledFields,
    challengePeriodDuration,
    embedded = false,
    onSubmitted,
  } = props
  const nativeCurrency = useNativeCurrency()
  const { address: account } = useAccount()
  const chainId = useTxChainId()
  const publicClient = usePublicClient()
  const { uploadFile } = useAtlasProvider()
  const listContext = useContext(TCRViewContext)
  const {
    deployedWithFactory,
    deployedWithLightFactory,
    deployedWithPermanentFactory,
  } = useFactory()

  const { fileURI, metadata } = metaEvidence || {}
  const { itemName, columns, tcrTitle } = metadata || {}
  const name = itemName || 'entry'

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldsComplete, setFieldsComplete] = useState(false)
  const [activeStage, setActiveStage] = useState<SubmissionStage>('field')
  const activeStep =
    activeStage === 'field' ? 0 : activeStage === 'policy' ? 1 : 2
  const fieldLabels = columns?.map((column) => column.label) || []

  // The breakdown comes from the caller (a badge list passes its own) or,
  // for the list in context, from the list's contract.
  const sameList =
    !!listContext?.tcrAddress &&
    !!tcrAddress &&
    listContext.tcrAddress.toLowerCase() === tcrAddress.toLowerCase()
  const baseDeposit =
    props.baseDeposit ??
    (sameList ? listContext?.submissionBaseDeposit : undefined)
  const arbitrationCost =
    props.arbitrationCost ??
    (sameList ? listContext?.arbitrationCost : undefined)

  const gate = useActionGate({
    verb: `submit the ${name}`,
    amount: submissionDeposit,
    pending:
      !metaEvidence || !submissionDeposit ? 'Loading the list' : undefined,
  })
  // Only the review step's confirm sends, with every field filled and the
  // wallet ready (connected, on the list's chain, signed in, funded).
  const submitAllowed =
    activeStage === 'preview' && fieldsComplete && gate.ready && !isSubmitting

  const goBack = useCallback(() => {
    if (activeStage === 'preview') {
      setActiveStage('policy')
      return
    }
    if (activeStage === 'policy') {
      setActiveStage('field')
      return
    }
    onCancel()
  }, [activeStage, onCancel])

  const goNext = useCallback(() => {
    if (activeStage === 'field') setActiveStage('policy')
    else if (activeStage === 'policy') setActiveStage('preview')
  }, [activeStage])

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
      if (!submitAllowed || !submissionDeposit) return
      setIsSubmitting(true)
      try {
        const resolvedValues = await resolveStashedFiles({
          columns,
          values,
          uploadFile,
          setFieldValue,
        })

        // Boolean columns as booleans: the encoder reads "false" as true.
        const encodedParams = gtcrEncode({
          columns,
          values: encoderValues(columns, resolvedValues),
        })

        // Simulated on the list's chain; writeContract refuses to send while
        // the wallet is on another one.
        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress as `0x${string}`,
          abi: _gtcr,
          functionName: 'addItem',
          args: [encodedParams],
          value: BigInt(submissionDeposit.toString()),
          account,
          chainId,
        })

        const result = await wrapWithToast(
          () => writeContract(wagmiConfig, request),
          publicClient!,
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
      account,
      chainId,
      onCancel,
      onSubmitted,
      publicClient,
      submissionDeposit,
      submitAllowed,
      tcrAddress,
      uploadFile,
    ],
  )

  const dialogTitle =
    typeof title === 'string' && title
      ? title
      : `Submit ${capitalizeFirstLetter(name)}`

  if (!metaEvidence || !submissionDeposit) {
    const placeholder = <SkeletonBlock $height="220px" />
    if (embedded) return placeholder
    return (
      <Dialog
        open={!!visible}
        onClose={onCancel}
        title={dialogTitle}
        width="lg"
      >
        {placeholder}
      </Dialog>
    )
  }

  const confirm = () => {
    const form = document.querySelector<HTMLFormElement>(
      `#${SUBMISSION_FORM_ID}`,
    )
    form?.requestSubmit()
  }

  const total = formatAmount(submissionDeposit, nativeCurrency)
  const period = challengePeriodDuration
    ? formatDurationLong(challengePeriodDuration.toNumber())
    : 'the challenge period'
  const receipt: ReceiptLine[] =
    baseDeposit && arbitrationCost
      ? [
          {
            label: 'Base deposit',
            value: formatAmount(baseDeposit, nativeCurrency),
          },
          {
            label: 'Arbitration cost',
            value: formatAmount(arbitrationCost, nativeCurrency),
          },
        ]
      : [{ label: 'Deposit (base + arbitration cost)', value: total }]
  const steps: OutcomeStep[] = [
    {
      title: `You deposit ${total} now`,
      body: `The ${name} is published and a challenge period of ${period} opens.`,
    },
    {
      title: 'No challenge',
      body: `After ${period} the request can be executed: the ${name} is registered and your ${total} comes back.`,
    },
    {
      title: 'If someone challenges',
      branch: true,
      body: "Kleros jurors check it against the listing policy. If they side with you, you get your deposit back plus the challenger's, less the arbitration cost; if not, it goes to the challenger.",
    },
  ]
  const confirmBlocker = !fieldsComplete
    ? 'Fill in every required field'
    : gate.blocker

  const navigation =
    activeStage === 'preview' ? (
      <Stack $gap={12}>
        <WhatHappensNext
          receipt={receipt}
          total={total}
          steps={steps}
          confirmLabel="Submit"
          onConfirm={confirm}
          confirmDisabled={!!confirmBlocker || isSubmitting}
          confirmBlocker={confirmBlocker}
          loading={isSubmitting}
          policy={`This is a deposit, not a fee. Amounts are in ${nativeCurrency}.`}
        />
        <SubmissionNavigation>
          <Button type="button" $variant="secondary" onClick={goBack}>
            Back
          </Button>
          {gate.controls && <Row $gap={8}>{gate.controls}</Row>}
        </SubmissionNavigation>
      </Stack>
    ) : (
      <SubmissionNavigation>
        <Button type="button" $variant="secondary" onClick={goBack}>
          {activeStage === 'field' ? 'Cancel' : 'Back'}
        </Button>
        <Button type="button" $variant="primary" onClick={goNext}>
          {activeStage === 'field'
            ? 'Continue to the policy'
            : 'Review the submission'}
        </Button>
      </SubmissionNavigation>
    )

  const submitContent = (
    <SubmissionFlowScaffold
      tcrTitle={tcrTitle}
      itemName={itemName}
      nativeCurrency={nativeCurrency}
      submissionDeposit={submissionDeposit}
      challengePeriodDuration={challengePeriodDuration}
      fileURI={fileURI}
      tcrAddress={tcrAddress}
      activeStep={activeStep}
      fieldLabels={fieldLabels}
      navigation={navigation}
    >
      <SubmissionForm
        columns={columns ?? []}
        activeStage={activeStage}
        canSubmit={submitAllowed}
        postSubmit={postSubmit}
        initialValues={initialValues}
        disabledFields={disabledFields ?? []}
        fileURI={fileURI}
        tcrAddress={tcrAddress}
        deployedWithFactory={deployedWithFactory}
        deployedWithLightFactory={deployedWithLightFactory}
        deployedWithPermanentFactory={deployedWithPermanentFactory}
        onFieldsComplete={setFieldsComplete}
      />
    </SubmissionFlowScaffold>
  )

  if (embedded) return submitContent

  return (
    <Dialog open={!!visible} onClose={onCancel} title={dialogTitle} width="lg">
      {submitContent}
    </Dialog>
  )
}

export default SubmitModal
