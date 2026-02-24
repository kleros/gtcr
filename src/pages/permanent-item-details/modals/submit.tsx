import React, { useCallback, useState, useEffect } from 'react'
import { Modal, Button, Form, Tooltip, Typography, Alert } from 'components/ui'
import Icon from 'components/ui/Icon'
import styled from 'styled-components'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { withFormik } from 'formik'
import humanizeDuration from 'humanize-duration'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { erc20Abi } from 'viem'
import { ItemTypes, typeDefaultValues } from '@kleros/gtcr-encoder'
import InputSelector from 'components/input-selector'
import EnsureAuth from 'components/ensure-auth'
import ETHAmount from 'components/eth-amount'
import useFactory from 'hooks/factory'
import { addPeriod, capitalizeFirstLetter, getArticleFor } from 'utils/string'
import { parseIpfs } from 'utils/ipfs-parse'
import { IPFSResultObject, getIPFSPath } from 'utils/get-ipfs-path'
import ipfsPublish from 'utils/ipfs-publish'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Column } from 'pages/item-details/modals/submit'
import { StyledSpin } from './challenge'

export const StyledAlert = styled(Alert)`
  margin-bottom: 16px;
`

export const StyledModal = styled(Modal)``

export const StyledParagraph = styled(Typography.Paragraph)`
  font-size: 14px;
  line-height: 1.6;
`

const StyledListingCriteria = styled(Typography.Paragraph)`
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.textSecondary};
  margin-top: 4px;
  margin-bottom: 16px;
`

export const DepositContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 6px;
  padding: 16px;
  margin: 16px 0;
  background: ${({ theme }) => theme.componentBackground};
`

export const DepositRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  }
`

export const DepositLabel = styled.span`
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
`

export const SUBMISSION_FORM_ID = 'submitItemForm'

const _SubmissionForm: React.FC<{
  style: React.CSSProperties
  columns: Column[]
  setFieldValue: (fieldName: string, value: string) => void
  handleSubmit: () => void
  disabledFields: boolean[]
  values: Record<string, string>
  errors: { [label: string]: string }
  touched: { [label: string]: boolean }
  onFieldsComplete?: (complete: boolean) => void
  status: {
    setFileToUpload: (f: (b: boolean) => void) => void
    setFileAsUploaded: (f: (b: boolean) => void) => void
  }
}> = (p) => {
  useEffect(() => {
    if (!p.onFieldsComplete || !p.columns) return
    const allFilled = p.columns.every((column) => {
      if (column.type === ItemTypes.BOOLEAN) return true
      if (column.optional) return true
      const value = p.values[column.label]
      return value !== undefined && value !== '' && String(value).trim() !== ''
    })
    p.onFieldsComplete(allFilled)
  }, [p.values, p.columns, p.onFieldsComplete])

  return (
    <Form onSubmit={p.handleSubmit} id={SUBMISSION_FORM_ID}>
      {p.columns &&
        p.columns.length > 0 &&
        p.columns.map((column, index) => (
          <InputSelector
            style={p.style}
            type={column.type}
            name={`${column.label}`}
            allowedFileTypes={column.allowedFileTypes}
            key={index}
            values={p.values}
            error={p.errors[column.label]}
            setFieldValue={p.setFieldValue}
            disabled={p.disabledFields && p.disabledFields[index]}
            touched={p.touched[column.label]}
            setFileToUpload={p.status.setFileToUpload}
            setFileAsUploaded={p.status.setFileAsUploaded}
            label={
              <span>
                {column.label}&nbsp;
                <Tooltip title={addPeriod(column.description)}>
                  <Icon type="question-circle-o" />
                </Tooltip>
              </span>
            }
          />
        ))}
    </Form>
  )
}

const SubmissionForm: React.ComponentType<Record<string, unknown>> = withFormik(
  {
    mapPropsToValues: ({
      columns,
      initialValues,
    }: {
      columns: Column[]
      initialValues?: string[]
    }) =>
      columns.reduce((acc: Record<string, string>, curr: Column, i: number) => {
        const defaultValue = initialValues
          ? initialValues[i]
          : curr.type === 'number'
            ? ''
            : // @ts-ignore
              typeDefaultValues[curr.type]

        return {
          ...acc,
          [curr.label]: String(defaultValue),
        }
      }, {}),
    handleSubmit: (values, { props, resetForm }) => {
      props.postSubmit(values, props.columns, resetForm)
    },
    mapPropsToStatus: (props) => ({
      setFileToUpload: props.setFileToUpload,
      setFileAsUploaded: props.setFileAsUploaded,
    }),
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
            .filter(({ type }: Column) => type === ItemTypes.GTCR_ADDRESS)
            .map(async ({ label }: Column) => ({
              isEmpty: !values[label],
              wasDeployedWithFactory:
                !!values[label] &&
                ((await deployedWithFactory(values[label])) ||
                  (await deployedWithLightFactory(values[label])) ||
                  (await deployedWithPermanentFactory(values[label]))),
              label: label,
            })),
        )
      )
        .filter(
          (res: {
            wasDeployedWithFactory: boolean
            isEmpty: boolean
            label: string
          }) => !res.wasDeployedWithFactory || res.isEmpty,
        )
        .reduce(
          (
            acc: Record<string, string>,
            curr: {
              wasDeployedWithFactory: boolean
              isEmpty: boolean
              label: string
            },
          ) => ({
            ...acc,
            [curr.label]: curr.isEmpty
              ? `Enter a list address to proceed.`
              : `This address was not deployed with the list creator.`,
          }),
          {},
        )
      if (Object.keys(errors as Record<string, string>).length > 0) throw errors
    },
  },
)(_SubmissionForm as React.ComponentType<Record<string, unknown>>)

const SubmitModal: React.FC<{
  onCancel: () => void
  tcrAddress: string
  tokenAddress: string
  initialValues: string[]
  submissionDeposit: { toString: () => string }
  metadata: {
    title: string
    itemName: string
    policyURI: string
  }
  columns: Column[]
  disabledFields: boolean[]
  submissionPeriod: string | number | undefined
  withdrawingPeriod: string | number | undefined
  arbitrationCost: { toString: () => string } | undefined
}> = (props) => {
  const {
    onCancel,
    initialValues,
    submissionDeposit,
    tcrAddress,
    tokenAddress,
    metadata,
    disabledFields,
    submissionPeriod,
    withdrawingPeriod,
    arbitrationCost,
    columns,
  } = props

  const nativeCurrency = useNativeCurrency()
  const {
    deployedWithFactory,
    deployedWithLightFactory,
    deployedWithPermanentFactory,
  } = useFactory()
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [balance, setBalance] = useState(0n)
  const [allowance, setAllowance] = useState(0n)
  const [nativeBalance, setNativeBalance] = useState<bigint>()
  const [checkingToken, setCheckingToken] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldsComplete, setFieldsComplete] = useState(false)
  const { symbol: tokenSymbol } = useTokenSymbol(tokenAddress)

  const { itemName, title, policyURI } = metadata || {}

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

  // Reset loading states when modal is closed
  useEffect(
    () => () => {
      setIsApproving(false)
      setIsSubmitting(false)
    },
    [],
  )

  const handleApprove = useCallback(async () => {
    setIsApproving(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          tcrAddress as `0x${string}`,
          BigInt(submissionDeposit.toString()),
        ],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient!.writeContract(request),
        publicClient!,
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
    checkTokenStatus,
    account,
    walletClient,
    publicClient,
  ])

  // To make sure user cannot press Submit while there are files uploading
  const [loadingCounter, setLoadingCounter] = useState(0)
  const setFileToUpload = (setUploading: (_: boolean) => void) => {
    setUploading(true)
    setLoadingCounter(loadingCounter + 1)
  }
  const setFileAsUploaded = (setUploading: (_: boolean) => void) => {
    setUploading(false)
    setLoadingCounter(loadingCounter - 1)
  }

  const postSubmit = useCallback(
    async (
      values: Record<string, string>,
      columns: Column[],
      resetForm: (nextState?: Record<string, unknown>) => void,
    ) => {
      setIsSubmitting(true)
      try {
        const enc = new TextEncoder()
        const fileData = enc.encode(JSON.stringify({ columns, values }))
        const ipfsEvidencePath = getIPFSPath(
          // @ts-ignore next-line
          (await ipfsPublish('item.json', fileData)) as IPFSResultObject,
        )

        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress as `0x${string}`,
          abi: _gtcr,
          functionName: 'addItem',
          args: [ipfsEvidencePath, BigInt(submissionDeposit.toString())],
          value: BigInt((arbitrationCost || 0).toString()),
          account,
        })

        const result = await wrapWithToast(
          () => walletClient!.writeContract(request),
          publicClient!,
        )

        if (result.status) {
          onCancel()
          resetForm({})
        }
      } catch (err) {
        console.error('Error submitting item:', err)
      errorToast(parseWagmiError(err))
      }
      setIsSubmitting(false)
    },
    [
      onCancel,
      submissionDeposit,
      tcrAddress,
      arbitrationCost,
      account,
      walletClient,
      publicClient,
    ],
  )

  const submissionDepositBigInt = submissionDeposit
    ? BigInt(submissionDeposit.toString())
    : 0n
  const hasEnoughBalance = balance >= submissionDepositBigInt
  const hasEnoughAllowance = allowance >= submissionDepositBigInt
  const hasEnoughNativeBalance =
    nativeBalance != null &&
    nativeBalance >= BigInt((arbitrationCost || 0).toString())

  const renderSubmitButton = () => {
    if (checkingToken)
      return (
        <Button key="checking" loading>
          Checking Token...
        </Button>
      )

    if (!hasEnoughBalance)
      return (
        <Button key="insufficient" disabled>
          Insufficient {tokenSymbol} Balance
        </Button>
      )

    if (!hasEnoughNativeBalance)
      return (
        <Button key="insufficientNative" disabled>
          Not enough {nativeCurrency}
        </Button>
      )

    if (!hasEnoughAllowance)
      return (
        <Button
          key="approve"
          type="primary"
          onClick={handleApprove}
          loading={isApproving}
        >
          Approve {tokenSymbol}
        </Button>
      )

    return (
      <Button
        key="challengeSubmit"
        type="primary"
        form={SUBMISSION_FORM_ID}
        htmlType="submit"
        disabled={!fieldsComplete}
        loading={loadingCounter > 0 || isSubmitting}
      >
        Submit
      </Button>
    )
  }

  if (!metadata || !submissionDeposit)
    return (
      // @ts-ignore
      <StyledModal
        title="Submit Item"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>,
        ]}
        {...props}
      >
        <StyledSpin />
      </StyledModal>
    )

  return (
    // @ts-ignore
    <StyledModal
      title={`Submit ${
        (itemName && capitalizeFirstLetter(itemName)) || 'Item'
      }`}
      footer={[
        <Button
          key="back"
          onClick={() => {
            setIsApproving(false)
            setIsSubmitting(false)
            onCancel()
          }}
        >
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">{renderSubmitButton()}</EnsureAuth>,
      ]}
      {...props}
    >
      <StyledParagraph>
        Submit{' '}
        {itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'}{' '}
        to {title || 'this list'} so other users can find it.
      </StyledParagraph>
      <SubmissionForm
        columns={columns}
        postSubmit={postSubmit}
        initialValues={initialValues}
        disabledFields={disabledFields}
        deployedWithFactory={deployedWithFactory}
        deployedWithLightFactory={deployedWithLightFactory}
        deployedWithPermanentFactory={deployedWithPermanentFactory}
        setFileToUpload={setFileToUpload}
        setFileAsUploaded={setFileAsUploaded}
        onFieldsComplete={setFieldsComplete}
      />
      <StyledListingCriteria>
        Make sure your submission complies with the{' '}
        <a
          href={parseIpfs(policyURI || '')}
          target="_blank"
          rel="noopener noreferrer"
        >
          listing criteria
        </a>{' '}
        to avoid challenges.
      </StyledListingCriteria>
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if your withdraw the item. ${
          submissionPeriod &&
          `The submission period of ${humanizeDuration(
            Number(submissionPeriod) * 1000,
          )} is the time it takes for the item to be considered valid.`
        }
          ${
            withdrawingPeriod &&
            `Withdrawing an item takes ${humanizeDuration(
              Number(withdrawingPeriod) * 1000,
            )}.`
          }`}
        type="info"
        showIcon
      />
      <DepositContainer>
        <DepositRow>
          <DepositLabel>
            Item Deposit
            <Tooltip title="The item deposit paid in tokens required to submit this item. This value is reimbursed at the end of the challenge period or, if there is a dispute, awarded to the party that wins.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </DepositLabel>
          <ETHAmount
            decimals={3}
            amount={submissionDeposit.toString()}
            displayUnit={` ${tokenSymbol}`}
          />
        </DepositRow>
        <DepositRow>
          <DepositLabel>
            Arbitration Cost
            <Tooltip title="The arbitration cost paid in native currency to cover potential disputes.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </DepositLabel>
          <ETHAmount
            decimals={3}
            amount={arbitrationCost ? arbitrationCost.toString() : '0'}
            displayUnit={` ${nativeCurrency}`}
          />
        </DepositRow>
      </DepositContainer>
      <DepositRow style={{ marginTop: 8 }}>
        <DepositLabel>Total deposit</DepositLabel>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <ETHAmount
            decimals={3}
            amount={submissionDeposit.toString()}
            displayUnit={` ${tokenSymbol}`}
          />
          <span style={{ margin: '0 6px' }}>+</span>
          <ETHAmount
            decimals={3}
            amount={arbitrationCost ? arbitrationCost.toString() : '0'}
            displayUnit={` ${nativeCurrency}`}
          />
        </span>
      </DepositRow>
    </StyledModal>
  )
}

export default SubmitModal
