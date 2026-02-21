import React, { useCallback, useState } from 'react'
import { ethers } from 'ethers'
import {
  Modal,
  Button,
  Form,
  Tooltip,
  Typography,
  Descriptions,
} from 'components/ui'
import Icon from 'components/ui/icon'
import styled from 'styled-components'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress, keccak256, encodePacked } from 'viem'
import { withFormik } from 'formik'
import humanizeDuration from 'humanize-duration'
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
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import { Column } from 'pages/item-details/modals/submit'
import { StyledSpin } from './challenge'
import { StyledAlert } from './remove'

export const StyledModal = styled(Modal)``

export const StyledParagraph = styled(Typography.Paragraph)`
  font-size: 14px;
  line-height: 1.6;
`

export const StyledListingCriteria = styled(Typography.Paragraph)`
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.textSecondary};
  margin-top: 4px;
  margin-bottom: 16px;
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
  status: {
    setFileToUpload: (f: (b: boolean) => void) => void
    setFileAsUploaded: (f: (b: boolean) => void) => void
  }
}> = (p) => (
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
  initialValues: string[]
  submissionDeposit: ethers.BigNumber
  metaEvidence: {
    metadata: {
      tcrTitle: string
      itemName: string
      columns: Column[]
      isTCRofTCRs: boolean
    }
    fileURI: string
  }
  disabledFields: boolean[]
  challengePeriodDuration: ethers.BigNumber
}> = (props) => {
  const {
    onCancel,
    initialValues,
    submissionDeposit,
    tcrAddress,
    metaEvidence,
    disabledFields,
    challengePeriodDuration,
  } = props
  const nativeCurrency = useNativeCurrency()
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const {
    deployedWithFactory,
    deployedWithLightFactory,
    deployedWithPermanentFactory,
  } = useFactory()

  const { fileURI, metadata } = metaEvidence || {}
  const { itemName, columns, tcrTitle } = metadata || {}

  const postSubmit = useCallback(
    async (
      values: Record<string, string>,
      columns: Column[],
      resetForm: (nextState?: Record<string, unknown>) => void,
    ) => {
      try {
        const enc = new TextEncoder()
        const fileData = enc.encode(JSON.stringify({ columns, values }))
        const ipfsEvidencePath = getIPFSPath(
          (await ipfsPublish('item.json', fileData)) as IPFSResultObject,
        )

        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress as `0x${string}`,
          abi: _gtcr,
          functionName: 'addItem',
          args: [ipfsEvidencePath],
          value: BigInt(submissionDeposit.toString()),
          account,
        })

        const result = await wrapWithToast(
          () => walletClient!.writeContract(request),
          publicClient!,
        )

        if (result.status) {
          onCancel()
          resetForm({})
          // Subscribe for notifications
          if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!chainId) {
            const itemID = keccak256(
              encodePacked(['string'], [ipfsEvidencePath]),
            )
            fetch(
              `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${chainId}/api/subscribe`,
              {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriberAddr: getAddress(account!),
                  tcrAddr: getAddress(tcrAddress as `0x${string}`),
                  itemID,
                  networkID: chainId,
                }),
              },
            ).catch((err) => {
              console.error('Failed to subscribe for notifications.', err)
            })
          }
        }
      } catch (err) {
        console.error('Error submitting item:', err)
      }
    },
    [
      account,
      chainId,
      onCancel,
      publicClient,
      submissionDeposit,
      tcrAddress,
      walletClient,
    ],
  )

  // To make sure user cannot press Submit while there are files uploading
  // submit will be blocked until there are no files uploading.
  const [loadingCounter, setLoadingCounter] = useState(0)
  const setFileToUpload = (setUploading: (_: boolean) => void) => {
    setUploading(true)
    setLoadingCounter(loadingCounter + 1)
  }
  const setFileAsUploaded = (setUploading: (_: boolean) => void) => {
    setUploading(false)
    setLoadingCounter(loadingCounter - 1)
  }

  if (!metaEvidence || !submissionDeposit)
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
        <Button key="back" onClick={onCancel}>
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">
          <Button
            key="challengeSubmit"
            type="primary"
            form={SUBMISSION_FORM_ID}
            htmlType="submit"
            loading={loadingCounter > 0}
          >
            Submit
          </Button>
        </EnsureAuth>,
      ]}
      {...props}
    >
      <StyledParagraph>
        Submit{' '}
        {itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'}{' '}
        to {tcrTitle || 'this list'} so other users can find it.
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
      />
      <StyledListingCriteria>
        Make sure your submission complies with the{' '}
        <a
          href={parseIpfs(fileURI || '')}
          target="_blank"
          rel="noopener noreferrer"
        >
          listing criteria
        </a>{' '}
        to avoid challenges.
      </StyledListingCriteria>
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if your submission is accepted. ${
          challengePeriodDuration &&
          `The challenge period lasts ${humanizeDuration(
            challengePeriodDuration.toNumber() * 1000,
          )}`
        }.`}
        type="info"
        showIcon
      />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
        style={{ marginTop: 4 }}
      >
        <Descriptions.Item
          label={
            <span>
              Total Deposit Required
              <Tooltip title="A deposit is required to submit. This value reimbursed at the end of the challenge period or, if there is a dispute, be awarded to the party that wins.">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          <ETHAmount
            decimals={3}
            amount={submissionDeposit.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default SubmitModal
