import React, { useState, useEffect, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { useDebounce } from 'use-debounce'
import type { BigNumber, ethers } from 'ethers'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { simulateContract } from '@wagmi/core'
import { getAddress, keccak256, encodePacked } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { addPeriod, isETHAddress } from 'utils/string'
import useUrlChainId from 'hooks/use-url-chain-id'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import useNativeCurrency from 'hooks/native-currency'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import {
  Body,
  Button,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  TextInput,
} from 'components/curate/primitives'
import {
  WhatHappensNext,
  type OutcomeStep,
  type ReceiptLine,
} from 'components/curate/what-happens-next'
import Select from 'components/ui/Select'
import { Dialog } from 'components/curate/item-light-dialog'
import { gatedConfirm, useActionGate } from 'components/curate/item-light-gate'
import { FieldLabel, Notice } from 'components/curate/item-light-notice'
import { formatAmount } from 'components/curate/item-light-format'
import { SubmissionFlowScaffold, SubmissionNavigation } from './submit'

/*
 * Enable a badge: connect a badge list to a parent list by submitting the
 * pair, plus a match file of the columns compared, to the parent's
 * connected list. The deposit is the connected list's submission deposit.
 */

const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

/* The app's glass Select, at the field's full width. */
const ColumnSelect = styled(Select)`
  display: block;
  width: 100%;
  min-width: 0;

  .ui-select-trigger {
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
`

const MatchRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: center;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`

const MatchCell = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;
`

interface SubmitConnectModalProps {
  onCancel: () => void
  initialValues?: string[]
  tcrAddress?: string
  gtcrView: ethers.Contract | undefined
  visible?: boolean
  [key: string]: unknown
}

const NONE = 'None'

const SubmitConnectModal = (props: SubmitConnectModalProps) => {
  const nativeCurrency = useNativeCurrency()
  const {
    onCancel,
    initialValues,
    tcrAddress: relTCRAddress,
    gtcrView,
    visible,
  } = props
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const urlChainId = useUrlChainId()
  const networkId = urlChainId ?? undefined
  const [error, setError] = useState<string>()

  // This is the main TCR.
  const [tcrAddr, setTCRAddr] = useState<string>()
  const [debouncedTCRAddr] = useDebounce(tcrAddr, 300)

  const [badgeTCRAddr, setBadgeTCRAddr] = useState<string>()
  const [debouncedBadgeTCRAddr] = useDebounce(badgeTCRAddr, 300)

  const [match, setMatch] = useState<{
    parentTCR?: string
    connectedTCR?: string
    badgeTCR?: string
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

  // Fetch the submission deposit of the connected list (on-chain, cached),
  // with its breakdown for the receipt.
  const arbitrableQuery = useQuery<{
    total: BigNumber
    base: BigNumber
    arbitrationCost: BigNumber
  }>({
    queryKey: [
      'fetchArbitrable',
      'light',
      'breakdown',
      relTCRAddress?.toLowerCase(),
    ],
    queryFn: async () => {
      const relTCRData = await gtcrView!.fetchArbitrable(relTCRAddress!)
      const { submissionBaseDeposit, arbitrationCost } = relTCRData
      return {
        total: submissionBaseDeposit.add(arbitrationCost),
        base: submissionBaseDeposit,
        arbitrationCost,
      }
    },
    enabled: !!relTCRAddress && !!gtcrView,
    staleTime: Infinity,
  })
  const relTCRSubmissionDeposit = arbitrableQuery.data?.total

  useEffect(() => {
    if (arbitrableQuery.error)
      setError((arbitrableQuery.error as Error).message)
  }, [arbitrableQuery.error])

  const handleChange = useCallback(
    (i: number, j: string | number) => {
      if (!badgeTCRMetadata || !tcrMetaEvidence) return
      let newState
      if (!match)
        newState = {
          parentTCR: debouncedTCRAddr,
          connectedTCR: relTCRAddress,
          badgeTCR: debouncedBadgeTCRAddr,
          columns: (badgeTCRMetadata.columns ?? []).map(() => null),
        }
      else newState = { ...match }

      if (Number(j) === 0)
        // User did not select a column (i.e. selected None).
        newState.columns[i] = null
      else newState.columns[i] = Number(j) - 1
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
    if (
      !relTCRMetaEvidence ||
      !relTCRAddress ||
      !relTCRSubmissionDeposit ||
      !account ||
      !walletClient ||
      !publicClient
    )
      return
    setIsSubmitting(true)
    try {
      const matchFile = new File([JSON.stringify(match)], 'match-file.json', {
        type: 'application/json',
      })
      const fileURI = await uploadFile(matchFile, JSON_UPLOAD_ROLE)
      if (!fileURI) throw new Error('Failed to upload match file to IPFS.')
      const columns = relTCRMetaEvidence.metadata?.columns ?? []

      const values = {
        Address: badgeTCRAddr,
        'Match File URI': fileURI,
      }

      const itemFile = new File(
        [JSON.stringify({ columns, values })],
        'item.json',
        { type: 'application/json' },
      )
      const ipfsEvidencePath = await uploadFile(itemFile, JSON_UPLOAD_ROLE)
      if (!ipfsEvidencePath)
        throw new Error('Failed to upload item metadata to IPFS.')

      const { request } = await simulateContract(wagmiConfig, {
        address: relTCRAddress as `0x${string}`,
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
    uploadFile,
    walletClient,
  ])

  const submitDisabled = useMemo(
    () => !match || match.columns.filter((col) => col !== null).length === 0,
    [match],
  )

  const gate = useActionGate({
    verb: 'enable the badge',
    shortVerb: 'enable the badge',
    amount: relTCRSubmissionDeposit,
    pending: relTCRSubmissionDeposit ? undefined : 'Loading the deposit',
  })

  if (!relTCRMetaEvidence || !relTCRSubmissionDeposit)
    return (
      <Dialog
        open={!!visible}
        onClose={onCancel}
        title="Enable a badge"
        width="lg"
      >
        <SkeletonBlock $height="220px" />
      </Dialog>
    )

  const { fileURI } = relTCRMetaEvidence
  if (error)
    return (
      <Dialog
        open={!!visible}
        onClose={onCancel}
        title="Enable a badge"
        footer={
          <Button type="button" $variant="secondary" onClick={onCancel}>
            Back
          </Button>
        }
      >
        <Notice tone="contested" role="alert">
          {error}
        </Notice>
      </Dialog>
    )

  const total = formatAmount(relTCRSubmissionDeposit, nativeCurrency)
  const receipt: ReceiptLine[] = arbitrableQuery.data
    ? [
        {
          label: 'Base deposit',
          value: formatAmount(arbitrableQuery.data.base, nativeCurrency),
        },
        {
          label: 'Arbitration cost',
          value: formatAmount(
            arbitrableQuery.data.arbitrationCost,
            nativeCurrency,
          ),
        },
      ]
    : [{ label: 'Deposit (base + arbitration cost)', value: total }]
  const steps: OutcomeStep[] = [
    {
      title: `You deposit ${total} now`,
      body: 'The badge connection is submitted to the connected list and its challenge period opens.',
    },
    {
      title: 'No challenge',
      body: 'After the challenge period the request can be executed: the badge is enabled and your deposit comes back.',
    },
    {
      title: 'If someone challenges',
      branch: true,
      body: "Kleros jurors check it against the listing policy. If they side with you, you get your deposit back plus the challenger's, less the arbitration cost; if not, it goes to the challenger.",
    },
  ]
  const confirmBlocker = submitDisabled
    ? 'Match at least one identifier column'
    : gate.blocker

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel}
      title="Enable a badge"
      width="lg"
    >
      <SubmissionFlowScaffold
        tcrTitle={relTCRMetaEvidence.metadata?.tcrTitle || 'this list'}
        itemName="badge"
        nativeCurrency={nativeCurrency}
        submissionDeposit={relTCRSubmissionDeposit}
        fileURI={fileURI}
        activeStep={0}
        steps={['Connect the lists', 'Review and confirm']}
        fieldLabels={[
          'Parent list address',
          'Badge list address',
          'Column matching',
        ]}
        navigation={
          <Stack $gap={12}>
            <WhatHappensNext
              receipt={receipt}
              total={total}
              steps={steps}
              {...gatedConfirm(gate, {
                label: 'Enable badge',
                onConfirm: handleSubmit,
                disabled: !!confirmBlocker || isSubmitting,
                blocker: confirmBlocker,
                loading: isSubmitting,
              })}
              policy={`This is a deposit, not a fee. Amounts are in ${nativeCurrency}.`}
            />
            <SubmissionNavigation>
              <Button type="button" $variant="secondary" onClick={onCancel}>
                Back
              </Button>
              {!gate.fix && gate.controls && (
                <Row $gap={8}>{gate.controls}</Row>
              )}
            </SubmissionNavigation>
          </Stack>
        }
      >
        <Stack $gap={16}>
          <Body $muted>
            An entry has a badge when it is also present on the badge list. The
            lists are compared on the matched columns, and every matched value
            must be identical, so match the fewest columns that identify an
            entry on both lists.
          </Body>
          <FieldBlock>
            <FieldLabel htmlFor="connect-parent-list">
              Parent list address
            </FieldLabel>
            {initialValues ? (
              <TextInput
                id="connect-parent-list"
                value={initialValues[0]}
                disabled
              />
            ) : (
              <TextInput
                id="connect-parent-list"
                placeholder="0x…"
                onChange={(e) => setTCRAddr(e.target.value)}
              />
            )}
          </FieldBlock>
          <FieldBlock>
            <FieldLabel htmlFor="connect-badge-list">
              Badge list address
            </FieldLabel>
            <TextInput
              id="connect-badge-list"
              placeholder="0x…"
              onChange={(e) => setBadgeTCRAddr(e.target.value)}
              disabled={!tcrMetaEvidence}
            />
            {!tcrMetaEvidence && (
              <Small $muted>Enter a valid parent list address first.</Small>
            )}
          </FieldBlock>
          {badgeTCRMetadata && (
            <Stack $gap={10}>
              <Small $muted>
                For each badge column, pick the parent list column it should
                match. Only identifier columns can be matched.
              </Small>
              {(badgeTCRMetadata.columns ?? []).map((column, i) => {
                const selectId = `connect-match-${i}`
                return (
                  <MatchRow key={i}>
                    <FieldLabel
                      id={`${selectId}-label`}
                      htmlFor={selectId}
                      title={
                        column.description
                          ? addPeriod(column.description)
                          : undefined
                      }
                    >
                      {column.label}
                    </FieldLabel>
                    {tcrMetaEvidence?.metadata ? (
                      <MatchCell>
                        <ColumnSelect
                          id={selectId}
                          aria-labelledby={`${selectId}-label`}
                          aria-describedby={
                            column.isIdentifier ? undefined : `${selectId}-why`
                          }
                          defaultValue={0}
                          disabled={!column.isIdentifier}
                          onChange={(value) => handleChange(i, Number(value))}
                        >
                          {[
                            { label: NONE },
                            ...(tcrMetaEvidence.metadata.columns ?? []),
                          ].map((parentColumn, j) => (
                            <Select.Option value={j} key={j}>
                              {parentColumn.label}
                            </Select.Option>
                          ))}
                        </ColumnSelect>
                        {!column.isIdentifier && (
                          <Small $muted id={`${selectId}-why`}>
                            Not an identifier column, so it is not matched.
                          </Small>
                        )}
                      </MatchCell>
                    ) : (
                      <SkeletonBlock $height="40px" />
                    )}
                  </MatchRow>
                )
              })}
            </Stack>
          )}
        </Stack>
      </SubmissionFlowScaffold>
    </Dialog>
  )
}

export default SubmitConnectModal
