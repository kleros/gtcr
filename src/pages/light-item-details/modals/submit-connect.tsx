import React, { useState, useEffect, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import {
  Button,
  Typography,
  Descriptions,
  Input,
  Col,
  Row,
  Form,
  Tooltip,
  Select,
  Skeleton,
  Result,
  Alert,
} from 'components/ui'
import Icon from 'components/ui/Icon'
import { useDebounce } from 'use-debounce'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import ETHAmount from 'components/eth-amount'
import { addPeriod, isETHAddress } from 'utils/string'
import { ethers } from 'ethers'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { simulateContract } from '@wagmi/core'
import { getAddress, keccak256, encodePacked } from 'viem'
import ipfsPublish from 'utils/ipfs-publish'
import useNativeCurrency from 'hooks/native-currency'
import useNativeBalance from 'hooks/use-native-balance'
import useGetLogs from 'hooks/get-logs'
import { parseIpfs } from 'utils/ipfs-parse'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { StyledModal, StyledSpin, InsufficientBalanceText } from './challenge'

export const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

export const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ui-skeleton-title {
    margin: -3px 0;
  }
`

export const SkeletonTitleProps = { width: '90px' }

interface SubmitConnectModalProps {
  onCancel: () => void
  initialValues?: string[]
  tcrAddress?: string
  gtcrView: ethers.Contract | undefined
  [key: string]: unknown
}

const SubmitConnectModal = (props: SubmitConnectModalProps) => {
  const nativeCurrency = useNativeCurrency()
  const { balance: nativeBalance } = useNativeBalance()
  const { onCancel, initialValues, tcrAddress: relTCRAddress, gtcrView } = props
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const urlChainId = useUrlChainId()
  const networkId = urlChainId ?? undefined
  const library = useEthersProvider({ chainId: networkId })
  const [error, setError] = useState<string>()

  // This is the main TCR.
  // TODO: Find a way to fetch this information from somewhere without centralization. The user should not have to type this.
  const [tcrAddr, setTCRAddr] = useState<string>()
  const [debouncedTCRAddr] = useDebounce(tcrAddr, 300)
  const [tcrMetaEvidence, setTCRMetaEvidence] = useState<MetaEvidence>()

  const [badgeTCRAddr, setBadgeTCRAddr] = useState<string>() // This is the TCR the user wants enable as a badge.
  const [debouncedBadgeTCRAddr] = useDebounce(badgeTCRAddr, 300)
  const [badgeTCRMetadata, setBadgeTCRMetadata] =
    useState<MetaEvidence['metadata']>()

  const [relTCRMetaEvidence, setRelTCRMetaEvidence] = useState<MetaEvidence>()
  const [relTCRSubmissionDeposit, setRelTCRSubmissionDeposit] =
    useState<ethers.BigNumber>()

  const [match, setMatch] = useState<{
    parentTCR: string
    connectedTCR: string
    badgeTCR: string
    columns: (number | null)[]
  }>()
  const getLogs = useGetLogs(library)

  // Set initial values, if any.
  useEffect(() => {
    if (!initialValues) return
    setTCRAddr(initialValues[0])
  }, [initialValues])

  // Fetch metadata of the parent TCR.
  useEffect(() => {
    if (!debouncedTCRAddr) return
    if (!isETHAddress(debouncedTCRAddr)) return
    if (!library || !networkId) return
    if (!getLogs) return
    ;(async () => {
      try {
        const tcr = new ethers.Contract(debouncedTCRAddr, _gtcr, library)
        const logs = (
          await getLogs({
            ...tcr.filters.MetaEvidence(),
            fromBlock: 0,
          })
        ).map((log) => tcr.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        setTCRMetaEvidence(
          await (await fetch(parseIpfs(metaEvidencePath))).json(),
        )
      } catch (err) {
        console.error('Error fetching TCR metadata', err)
        setError('Error fetching list metadata')
      }
    })()
  }, [debouncedTCRAddr, library, networkId, getLogs])

  // Fetch metadata of the badge TCR.
  useEffect(() => {
    if (!debouncedBadgeTCRAddr) return
    if (!isETHAddress(debouncedBadgeTCRAddr)) return
    if (!library || !networkId) return
    if (!getLogs) return
    ;(async () => {
      try {
        const badgeTCR = new ethers.Contract(
          debouncedBadgeTCRAddr,
          _gtcr,
          library,
        )
        const logs = (
          await getLogs({
            ...badgeTCR.filters.MetaEvidence(),
            fromBlock: 0,
          })
        ).map((log) => badgeTCR.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const file = await (await fetch(parseIpfs(metaEvidencePath))).json()
        setBadgeTCRMetadata(file.metadata)
      } catch (err) {
        console.error('Error fetching TCR metadata', err)
        setError('Error fetching list metadata')
      }
    })()
  }, [debouncedBadgeTCRAddr, library, networkId, getLogs])

  // Fetch meta evidence and tcr data from connect tcr.
  useEffect(() => {
    if (!relTCRAddress || !gtcrView) return
    if (!getLogs) return
    ;(async () => {
      try {
        const relTCR = new ethers.Contract(relTCRAddress, _gtcr, library)
        const logs = (
          await getLogs({
            ...relTCR.filters.MetaEvidence(),
            fromBlock: 0,
          })
        ).map((log) => relTCR.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const [fileResponse, relTCRData] = await Promise.all([
          fetch(parseIpfs(metaEvidencePath)),
          gtcrView.fetchArbitrable(relTCRAddress),
        ])

        // Submission deposit = submitter base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const { submissionBaseDeposit, arbitrationCost } = relTCRData
        const submissionDeposit = submissionBaseDeposit.add(arbitrationCost)

        const file = await fileResponse.json()
        setRelTCRMetaEvidence(file)
        setRelTCRSubmissionDeposit(submissionDeposit)
      } catch (err) {
        console.error(err)
        setError((err as Error).message)
      }
    })()
  }, [gtcrView, library, relTCRAddress, getLogs])

  const NONE = 'None'
  const handleChange = useCallback(
    (i: number, j: number) => {
      if (!badgeTCRMetadata || !tcrMetaEvidence) return
      let newState
      if (!match)
        newState = {
          parentTCR: debouncedTCRAddr,
          connectedTCR: relTCRAddress,
          badgeTCR: debouncedBadgeTCRAddr,
          columns: badgeTCRMetadata.columns.map(() => null),
        }
      else newState = { ...match }

      if (Number(j) === 0)
        // User did not select a column (i.e. selected None).
        newState.columns[i] = null
      else newState.columns[i] = j - 1
      setMatch(newState)
    },
    [
      badgeTCRMetadata,
      debouncedBadgeTCRAddr,
      debouncedTCRAddr,
      match,
      relTCRAddress,
      tcrMetaEvidence,
    ],
  )

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!relTCRMetaEvidence) return
    setIsSubmitting(true)
    try {
      const file = new TextEncoder().encode(JSON.stringify(match))
      const ipfsFileObj = await ipfsPublish('match-file.json', file)
      const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`
      const { columns } = relTCRMetaEvidence.metadata

      const values = {
        Address: badgeTCRAddr,
        'Match File URI': fileURI,
      }

      const enc = new TextEncoder()
      const fileData = enc.encode(JSON.stringify({ columns, values }))
      const ipfsEvidencePath = getIPFSPath(
        await ipfsPublish('item.json', fileData),
      )

      const { request } = await simulateContract(wagmiConfig, {
        address: relTCRAddress,
        abi: _gtcr,
        functionName: 'addItem',
        args: [ipfsEvidencePath],
        value: BigInt(relTCRSubmissionDeposit.toString()),
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        onCancel()

        if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!chainId) {
          const itemID = keccak256(encodePacked(['string'], [ipfsEvidencePath]))
          fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${chainId}/api/subscribe`,
            {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriberAddr: getAddress(account),
                tcrAddr: getAddress(relTCRAddress),
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
      console.error('Error submitting badge connection:', err)
      errorToast(parseWagmiError(err))
    }
    setIsSubmitting(false)
  }, [
    account,
    badgeTCRAddr,
    chainId,
    match,
    onCancel,
    publicClient,
    relTCRAddress,
    relTCRMetaEvidence,
    relTCRSubmissionDeposit,
    walletClient,
  ])

  const insufficientBalance =
    nativeBalance !== undefined &&
    relTCRSubmissionDeposit &&
    nativeBalance < BigInt(relTCRSubmissionDeposit.toString())

  const submitDisabled = useMemo(
    () => !match || match.columns.filter((col) => col !== null).length === 0,
    [match],
  )

  if (!relTCRMetaEvidence || !relTCRSubmissionDeposit)
    return (
      <StyledModal
        title="Enable Badge"
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

  const { fileURI } = relTCRMetaEvidence
  if (error)
    return (
      <StyledModal
        title="Enable Badge"
        footer={[
          <Button key="back" onClick={onCancel}>
            Back
          </Button>,
        ]}
        {...props}
      >
        <Result status="warning" title={error} />
      </StyledModal>
    )

  return (
    <StyledModal
      title="Enable Badge"
      footer={[
        <Button key="back" onClick={onCancel}>
          Back
        </Button>,
        <div key="submit">
          <Button
            type="primary"
            htmlType="submit"
            onClick={handleSubmit}
            disabled={submitDisabled || !!insufficientBalance}
            loading={isSubmitting}
          >
            Submit
          </Button>
          {insufficientBalance && (
            <InsufficientBalanceText>
              Insufficient balance
            </InsufficientBalanceText>
          )}
        </div>,
      ]}
      {...props}
    >
      <Typography.Title level={4}>
        Read the&nbsp;
        <a
          href={parseIpfs(fileURI || '')}
          target="_blank"
          rel="noopener noreferrer"
        >
          Listing Criteria
        </a>
        .
      </Typography.Title>
      <Form.Item
        label={
          <span>
            Parent list Address&nbsp;
            <Tooltip title="Fill with the address of the parent list.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </span>
        }
        style={{ marginBottom: '12px' }}
      >
        {initialValues ? (
          <Input value={initialValues[0]} disabled />
        ) : (
          <Input
            placeholder="0x1337deadbeef..."
            onChange={(e) => setTCRAddr(e.target.value)}
          />
        )}
      </Form.Item>
      <Form.Item
        label={
          <span>
            Badge list address&nbsp;
            <Tooltip title="Fill here the address of the badge list.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </span>
        }
      >
        <Input
          placeholder="0xbeafb047beef..."
          onChange={(e) => setBadgeTCRAddr(e.target.value)}
          disabled={!tcrMetaEvidence}
        />
      </Form.Item>
      <StyledAlert
        message="Understand Badges"
        description="An item has a badge if it is also present on the badge list. As an example, a token submission 'PNK' on a list of Tokens can display the ERC20 Badge if the same submission is also present on the ERC20 Badge list. To check if an item is present on two lists we must match common fields. In the example we would choose field 'Address'. The comparison is strict, in other words, if multiple fields are matched, ALL values must match perfectly. In general, you should use the least amount of columns that are enough to uniquely identify a submission on both lists to avoid items not being detected due to (for example, case differences)."
        type="info"
        showIcon
      />
      <Typography.Paragraph>
        Match at least one ID column of the parent list to use to when searching
        for the item in the badge list. The more fields matched, the stricter
        the search.
      </Typography.Paragraph>
      {badgeTCRMetadata &&
        badgeTCRMetadata.columns.map((column, i) => (
          <Row key={i} gutter={[8, 8]}>
            <Col span={12}>
              <span>
                {column.label}
                {column.description && (
                  <Tooltip title={addPeriod(column.description)}>
                    &nbsp;
                    <Icon type="question-circle-o" />
                  </Tooltip>
                )}
              </span>
            </Col>
            <Col span={12}>
              {tcrMetaEvidence.metadata ? (
                <Select
                  defaultValue={NONE}
                  style={{ width: '100%' }}
                  onChange={(_, { key }) => handleChange(i, key)}
                  disabled={!column.isIdentifier}
                >
                  {[{ label: NONE }, ...tcrMetaEvidence.metadata.columns].map(
                    (column, j) => (
                      <Select.Option value={column.label} key={j}>
                        {column.label}
                      </Select.Option>
                    ),
                  )}
                </Select>
              ) : (
                <StyledSkeleton
                  active
                  paragraph={false}
                  title={SkeletonTitleProps}
                />
              )}
            </Col>
          </Row>
        ))}
      <Typography.Paragraph>
        A deposit is required to submit. This value reimbursed at the end of the
        challenge period or, if there is a dispute, be awarded to the party that
        wins.
      </Typography.Paragraph>
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount
            decimals={3}
            amount={relTCRSubmissionDeposit.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default SubmitConnectModal
