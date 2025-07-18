import React, { useContext, useCallback, useState } from 'react'
import {
  Modal,
  Button,
  Form,
  Tooltip,
  Icon,
  Typography,
  Descriptions,
  Alert
} from 'antd'
import styled from 'styled-components'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { ethers } from 'ethers'
import { withFormik } from 'formik'
import humanizeDuration from 'humanize-duration'
import { WalletContext } from 'contexts/wallet-context'
import { ItemTypes, typeDefaultValues } from '@kleros/gtcr-encoder'
import InputSelector from 'components/input-selector'
import ETHAmount from 'components/eth-amount'
import useFactory from 'hooks/factory'
import { TourContext } from 'contexts/tour-context'
import { addPeriod, capitalizeFirstLetter, getArticleFor } from 'utils/string'
import { parseIpfs } from 'utils/ipfs-parse'
import { IPFSResultObject, getIPFSPath } from 'utils/get-ipfs-path'
import ipfsPublish from 'utils/ipfs-publish'
import useNativeCurrency from 'hooks/native-currency'
import { Column } from 'pages/item-details/modals/submit'
import { StyledSpin } from './challenge'

export const StyledAlert = styled(Alert)`
  margin-bottom: 12px;
  text-transform: initial;
`

export const StyledModal = styled(Modal)`
  text-transform: capitalize;
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

export const StyledParagraph = styled(Typography.Paragraph)`
  text-transform: none;
`

export const SUBMISSION_FORM_ID = 'submitItemForm'

const _SubmissionForm: React.FC<{
  style: any
  columns: Column[]
  setFieldValue: (fieldName: string, value: any) => void
  handleSubmit: () => void
  disabledFields: boolean[]
  values: any
  errors: { [label: string]: any }
  touched: { [label: string]: boolean }
  status: {
    setFileToUpload: (f: (b: boolean) => void) => void
    setFileAsUploaded: (f: (b: boolean) => void) => void
  }
}> = p => (
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

const SubmissionForm: React.ComponentType<any> = withFormik({
  mapPropsToValues: ({ columns, initialValues }: any) =>
    columns.reduce((acc: any, curr: any, i: number) => {
      const defaultValue = initialValues
        ? initialValues[i]
        : // @ts-ignore
          typeDefaultValues[curr.type]

      return {
        ...acc,
        [curr.label]: String(defaultValue)
      }
    }, {}),
  handleSubmit: (values, { props, resetForm }) => {
    props.postSubmit(values, props.columns, resetForm)
  },
  mapPropsToStatus: props => ({
    setFileToUpload: props.setFileToUpload,
    setFileAsUploaded: props.setFileAsUploaded
  }),
  validate: async (
    values,
    { columns, deployedWithFactory, deployedWithLightFactory }
  ) => {
    const errors = (
      await Promise.all(
        columns
          .filter(({ type }: any) => type === ItemTypes.GTCR_ADDRESS)
          .map(async ({ label }: any) => ({
            isEmpty: !values[label],
            wasDeployedWithFactory:
              !!values[label] &&
              ((await deployedWithFactory(values[label])) ||
                (await deployedWithLightFactory(values[label]))),
            label: label
          }))
      )
    )
      .filter((res: any) => !res.wasDeployedWithFactory || res.isEmpty)
      .reduce(
        (acc: any, curr: any) => ({
          ...acc,
          [curr.label]: curr.isEmpty
            ? `Enter a list address to proceed.`
            : `This address was not deployed with the list creator.`
        }),
        {}
      )
    if (Object.keys(errors as any).length > 0) throw errors
  }
})(_SubmissionForm as any)

const SubmitModal: React.FC<{
  onCancel: any
  tcrAddress: string
  initialValues: any[]
  submissionDeposit: any
  metadata: {
    title: string
    itemName: string
    // columns: any[] // we got a problem here; subgraph doesnt have this...
    policyURI: string
  }
  columns: any[] // provisional...
  disabledFields: boolean[]
  submissionPeriod: any
  withdrawingPeriod: any
  arbitrationCost: any
}> = props => {
  const {
    onCancel,
    initialValues,
    submissionDeposit,
    tcrAddress,
    metadata,
    disabledFields,
    submissionPeriod,
    withdrawingPeriod,
    arbitrationCost,
    columns
  } = props

  const nativeCurrency = useNativeCurrency()
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const { deployedWithFactory, deployedWithLightFactory } = useFactory()

  const { itemName, title, policyURI } = metadata || {}
  console.log({ arbitrationCost })
  const postSubmit = useCallback(
    (values, columns, resetForm) => {
      pushWeb3Action(async ({ account, networkId }: any, signer: any) => {
        const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
        const enc = new TextEncoder()
        const fileData = enc.encode(JSON.stringify({ columns, values }))
        const ipfsEvidencePath = getIPFSPath(
          // @ts-ignore next-line
          (await ipfsPublish('item.json', fileData)) as IPFSResultObject
        )

        // Request signature and submit.
        // TODOv2 allow choosing item stake amount
        // TODO approve needs to be done beforehand as a distinct action
        const tx = await gtcr.addItem(
          ipfsEvidencePath,
          submissionDeposit,
          {
            value: arbitrationCost
          }
        )

        onCancel() // Hide the submission modal.
        resetForm({})
        return {
          tx,
          actionMessage: `Submitting ${(itemName && itemName.toLowerCase()) ||
            'item'}`
        }
      })
    },
    [
      itemName,
      onCancel,
      pushWeb3Action,
      setUserSubscribed,
      submissionDeposit,
      tcrAddress
    ]
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

  if (!metadata || !submissionDeposit)
    return (
      // @ts-ignore
      <StyledModal
        title="Submit Item"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>
        ]}
        {...props}
      >
        <StyledSpin />
      </StyledModal>
    )

  return (
    // @ts-ignore
    <StyledModal
      title={`Submit ${(itemName && capitalizeFirstLetter(itemName)) ||
        'Item'}`}
      footer={[
        <Button key="back" onClick={onCancel}>
          Back
        </Button>,
        <Button
          key="challengeSubmit"
          type="primary"
          form={SUBMISSION_FORM_ID}
          htmlType="submit"
          loading={loadingCounter > 0}
        >
          Submit
        </Button>
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
        setFileToUpload={setFileToUpload}
        setFileAsUploaded={setFileAsUploaded}
      />
      <Typography.Paragraph>
        Make sure your submission complies with the{' '}
        <a
          href={parseIpfs(policyURI || '')}
          target="_blank"
          rel="noopener noreferrer"
        >
          listing criteria
        </a>{' '}
        to avoid challenges.
      </Typography.Paragraph>
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if your withdraw the item. ${submissionPeriod &&
          `The submission period of ${humanizeDuration(
            Number(submissionPeriod) * 1000
          )} is the time it takes for the item to be considered valid.`}
          ${withdrawingPeriod &&
            `Withdrawing an item takes ${humanizeDuration(
              Number(withdrawingPeriod) * 1000
            )}.`}`}
        type="info"
        showIcon
      />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
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
            // displayUnit={` ${nativeCurrency}`} TODO the registry's token
            displayUnit={' sDAI'}
          />
          {/* todo you need to notify of the xDAI or native amount that is sent here */}
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default SubmitModal
