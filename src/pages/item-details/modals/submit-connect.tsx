import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Result,
} from 'components/ui'
import Icon from 'components/ui/Icon'
import { useDebounce } from 'use-debounce'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import ETHAmount from 'components/eth-amount'
import { addPeriod, isETHAddress } from 'utils/string'
import { ethers } from 'ethers'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { simulateContract } from '@wagmi/core'
import { keccak256, encodePacked, getAddress } from 'viem'
import ipfsPublish from 'utils/ipfs-publish'
import { gtcrEncode } from '@kleros/gtcr-encoder'
import useNativeCurrency from 'hooks/native-currency'
import useNativeBalance from 'hooks/use-native-balance'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import { parseIpfs } from 'utils/ipfs-parse'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import {
  StyledSpin,
  StyledModal,
  InsufficientBalanceText,
} from 'pages/light-item-details/modals/challenge'
import {
  StyledAlert,
  StyledSkeleton,
  SkeletonTitleProps,
} from 'pages/light-item-details/modals/submit-connect'

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
  const [error, setError] = useState<string>()

  // This is the main TCR.
  const [tcrAddr, setTCRAddr] = useState<string>()
  const [debouncedTCRAddr] = useDebounce(tcrAddr, 300)

  const [badgeTCRAddr, setBadgeTCRAddr] = useState<string>()
  const [debouncedBadgeTCRAddr] = useDebounce(badgeTCRAddr, 300)

  const [match, setMatch] = useState<{
    parentTCR: string
    connectedTCR: string
    badgeTCR: string
    columns: (number | null)[]
  }>()

  // Set initial values, if any.
  useEffect(() => {
    if (!initialValues) return
    setTCRAddr(initialValues[0])
  }, [initialValues])

  // Fetch MetaEvidence via subgraph (cached for 1 day).
  const validParentAddr =
    debouncedTCRAddr && isETHAddress(debouncedTCRAddr)
      ? debouncedTCRAddr
      : undefined
  const validBadgeAddr =
    debouncedBadgeTCRAddr && isETHAddress(debouncedBadgeTCRAddr)
      ? debouncedBadgeTCRAddr
      : undefined

  const parentMetaQuery = useTcrMetaEvidence(validParentAddr, networkId)
  const badgeMetaQuery = useTcrMetaEvidence(validBadgeAddr, networkId)
  const relMetaQuery = useTcrMetaEvidence(relTCRAddress, networkId)

  const tcrMetaEvidence = parentMetaQuery.data ?? undefined
  const badgeTCRMetadata = badgeMetaQuery.data?.metadata
  const relTCRMetaEvidence = relMetaQuery.data ?? undefined

  // Fetch submission deposit for the relation TCR (on-chain, cached).
  const arbitrableQuery = useQuery<ethers.BigNumber>({
    queryKey: ['fetchArbitrable', 'classic', relTCRAddress?.toLowerCase()],
    queryFn: async () => {
      const relTCRData = await gtcrView!.fetchArbitrable(relTCRAddress!)
      const { submissionBaseDeposit, arbitrationCost } = relTCRData
      return submissionBaseDeposit.add(arbitrationCost)
    },
    enabled: !!relTCRAddress && !!gtcrView,
    staleTime: Infinity,
  })
  const relTCRSubmissionDeposit = arbitrableQuery.data

  useEffect(() => {
    if (arbitrableQuery.error)
      setError((arbitrableQuery.error as Error).message)
  }, [arbitrableQuery.error])

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

      if (Number(j) === 0) newState.columns[i] = null
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
    const file = new TextEncoder().encode(JSON.stringify(match))
    const fileURI = getIPFSPath(await ipfsPublish('match-file.json', file))
    const { columns } = relTCRMetaEvidence.metadata

    const values = {
      Address: badgeTCRAddr,
      'Match File URI': fileURI,
    }

    try {
      const encodedParams = gtcrEncode({
        columns,
        values,
      })

      const { request } = await simulateContract(wagmiConfig, {
        address: relTCRAddress,
        abi: _gtcr,
        functionName: 'addItem',
        args: [encodedParams],
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
          const itemID = keccak256(encodePacked(['bytes'], [encodedParams]))
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
      console.error('Error submitting badge:', err)
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
