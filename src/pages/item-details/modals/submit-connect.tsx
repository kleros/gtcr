import React, { useState, useEffect, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { useDebounce } from 'use-debounce'
import type { BigNumber, ethers } from 'ethers'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { simulateContract } from '@wagmi/core'
import {
  keccak256,
  encodePacked,
  getAddress,
  type Address,
  type Hex,
} from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import { gtcrEncode } from '@kleros/gtcr-encoder'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { addPeriod, isETHAddress } from 'utils/string'
import useUrlChainId from 'hooks/use-url-chain-id'
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
import { useActionGate } from 'components/curate/item-light-gate'
import { FieldLabel, Notice } from 'components/curate/item-light-notice'
import { formatAmount } from 'components/curate/item-light-format'
import {
  SubmissionFlowScaffold,
  SubmissionNavigation,
} from 'pages/light-item-details/modals/submit'

/*
 * Enable a badge on a Classic list: submit the pair (parent list, badge
 * list) plus a match file of the columns compared to the parent's connected
 * list. The item is encoded on chain with gtcrEncode; the deposit is the
 * connected list's submission deposit. Mounted by the Classic registry page
 * and the badges block of the item page.
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

  // The connected list's submission deposit (on-chain, cached), with its
  // breakdown for the receipt.
  const arbitrableQuery = useQuery<{
    total: BigNumber
    base: BigNumber
    arbitrationCost: BigNumber
  }>({
    queryKey: [
      'fetchArbitrable',
      'classic',
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
    (i: number, j: number) => {
      if (
        !badgeTCRMetadata?.columns ||
        !tcrMetaEvidence ||
        !debouncedTCRAddr ||
        !relTCRAddress ||
        !debouncedBadgeTCRAddr
      )
        return
      let newState
      if (!match)
        newState = {
          parentTCR: debouncedTCRAddr,
          connectedTCR: relTCRAddress,
          badgeTCR: debouncedBadgeTCRAddr,
          columns: badgeTCRMetadata.columns.map((): number | null => null),
        }
      else newState = { ...match }

      // 0 is "None": the badge column is not compared.
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
    if (
      !relTCRMetaEvidence?.metadata?.columns ||
      !relTCRAddress ||
      !relTCRSubmissionDeposit ||
      !account ||
      !walletClient ||
      !publicClient
    )
      return
    setIsSubmitting(true)
    const matchFile = new File([JSON.stringify(match)], 'match-file.json', {
      type: 'application/json',
    })
    const fileURI = await uploadFile(matchFile, JSON_UPLOAD_ROLE)
    if (!fileURI) {
      setIsSubmitting(false)
      errorToast('Failed to upload match file to IPFS.')
      return
    }
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
        address: relTCRAddress as Address,
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
          const itemID = keccak256(
            encodePacked(['bytes'], [encodedParams as Hex]),
          )
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
    uploadFile,
    walletClient,
  ])

  const submitDisabled = useMemo(
    () => !match || match.columns.filter((col) => col !== null).length === 0,
    [match],
  )

  const gate = useActionGate({
    verb: 'enable the badge',
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
        {error ? (
          <Notice tone="contested" role="alert">
            {error}
          </Notice>
        ) : (
          <SkeletonBlock $height="220px" />
        )}
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
    ? 'Match at least one column'
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
              confirmLabel="Enable badge"
              onConfirm={handleSubmit}
              confirmDisabled={!!confirmBlocker || isSubmitting}
              confirmBlocker={confirmBlocker}
              loading={isSubmitting}
              policy={`This is a deposit, not a fee. Amounts are in ${nativeCurrency}.`}
            />
            <SubmissionNavigation>
              <Button type="button" $variant="secondary" onClick={onCancel}>
                Back
              </Button>
              {gate.controls && <Row $gap={8}>{gate.controls}</Row>}
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
            <FieldLabel htmlFor="classic-connect-parent-list">
              Parent list address
            </FieldLabel>
            {initialValues ? (
              <TextInput
                id="classic-connect-parent-list"
                value={initialValues[0]}
                disabled
              />
            ) : (
              <TextInput
                id="classic-connect-parent-list"
                placeholder="0x…"
                onChange={(e) => setTCRAddr(e.target.value)}
              />
            )}
          </FieldBlock>
          <FieldBlock>
            <FieldLabel htmlFor="classic-connect-badge-list">
              Badge list address
            </FieldLabel>
            <TextInput
              id="classic-connect-badge-list"
              placeholder="0x…"
              onChange={(e) => setBadgeTCRAddr(e.target.value)}
              disabled={!tcrMetaEvidence}
            />
            {!tcrMetaEvidence && (
              <Small $muted>Enter a valid parent list address first.</Small>
            )}
          </FieldBlock>
          {badgeTCRMetadata?.columns && (
            <Stack $gap={10}>
              <Small $muted>
                For each badge column to compare, pick the parent list column it
                must equal. The more columns matched, the stricter the search.
              </Small>
              {badgeTCRMetadata.columns.map((column, i) => {
                const selectId = `classic-connect-match-${i}`
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
                      <ColumnSelect
                        id={selectId}
                        aria-labelledby={`${selectId}-label`}
                        defaultValue={0}
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
                    ) : (
                      <SkeletonBlock $height="44px" />
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
