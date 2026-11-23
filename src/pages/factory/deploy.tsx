import React, { useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  parseEther,
  encodeFunctionData,
  getContractAddress,
  decodeEventLog,
  type Address,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _GTCRFactory from 'assets/abis/LightGTCRFactory.json'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { ZERO_ADDRESS, getArticleFor } from 'utils/string'
import {
  wrapWithToast,
  errorToast,
  waitForOutcome,
} from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { formatDurationLong } from 'utils/time'
import { parseIpfs } from 'utils/ipfs-parse'
import { wagmiConfig } from 'config/wagmi'
import { NETWORKS_INFO, getExplorerUrl } from 'config/networks'
import useUrlChainId from 'hooks/use-url-chain-id'
import useStandardTcrView from 'hooks/standard-tcr-view'
import useNativeCurrency from 'hooks/native-currency'
import {
  defaultEvidenceDisplayUri,
  defaultTcrAddresses,
  lgtcrFactoryAddresses,
  txBatcherAddresses,
} from 'config/tcr-addresses'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonLink,
  Data,
  Label,
  Row,
  Small,
  Stack,
  StatusDot,
  truncateMiddle,
} from 'components/curate/primitives'
import {
  StepBody,
  StepHeader,
  useWalletGate,
} from 'components/curate/factory-shared-fields'
import { formatNative } from './amounts'
import { incompleteSteps, listInProse } from './schemas'
import { useCourtSummary } from 'components/curate/factory-shared-kleros'
import {
  TxData,
  TxLink,
  TxList,
  TxPill,
  TxStep,
  type TxStatus,
} from 'components/curate/factory-shared-layout'
import { withNormalizedFileTypes } from './file-types'
import { plainDecimal, typedNumber } from 'pages/factory-permanent/format'
import useArbitratorCheck from 'hooks/use-arbitrator-check'
import type { StepProps, TcrState } from '.'

/*
 * Step 4, deploy: a review of what was entered (each row can jump back to
 * its step), then the deployment as a transaction stepper: the IPFS upload
 * (with the files' paths), the one signature (two factory deployments
 * batched through the transaction batcher, gas only, with the predicted
 * addresses), the confirmations (with the hash and an explorer link), the
 * live list and the optional submission to the list of lists. The blockers
 * name what stops the deploy. The meta-evidence upload and the contract
 * calls are unchanged.
 */

/**
 * A typed amount in wei. The form can hold a number (5e-7) or text with
 * spaces or a decimal comma, which parseEther refuses after the uploads:
 * written out first.
 */
const toWei = (value: unknown): bigint => parseEther(plainDecimal(value))

/** A typed number times `scale`, in whole units: hours to seconds, percent to basis points. */
const toWhole = (value: unknown, scale: number): number =>
  Math.round(typedNumber(value) * scale)

/*
 * The badges list is deployed even when it is skipped (closed by a deposit
 * no one can pay), with whatever its fields hold. A field left half-typed
 * before switching it off must not fail the deploy after the uploads, so a
 * skipped list's values that don't parse go out as 0.
 */
const relWei = (value: unknown, skipped: boolean): bigint => {
  if (!skipped) return toWei(value)
  try {
    return toWei(value)
  } catch {
    return 0n
  }
}
const relWhole = (value: unknown, scale: number, skipped: boolean): number => {
  const whole = toWhole(value, scale)
  return skipped && !Number.isFinite(whole) ? 0 : whole
}

export const _txBatcher = [
  {
    constant: false,
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' },
    ],
    name: 'batchSend',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
]

const getTcrMetaEvidence = async (
  tcrState: TcrState,
  parentTCRAddress: string,
  evidenceDisplayInterfaceURI: string,
  uploadFile: (file: File, role: Roles) => Promise<string | null>,
) => {
  const {
    tcrTitle,
    tcrDescription,
    columns,
    itemName,
    itemNamePlural,
    tcrPrimaryDocument,
    tcrLogo,
    relColumns,
    relItemName,
    relItemNamePlural,
    relTcrPrimaryDocument,
    isTCRofTCRs,
    relTcrDisabled,
  } = tcrState
  const metadata = {
    tcrTitle,
    tcrDescription,
    // File types as the field stores them once left ("PDF, jpg" is "pdf
    // jpg jpeg"), even if the step was left without that.
    columns: withNormalizedFileTypes(columns),
    itemName: itemName.toLowerCase(),
    itemNamePlural: itemNamePlural.toLowerCase(),
    logoURI: tcrLogo,
    requireRemovalEvidence: true,
    isTCRofTCRs,
    relTcrDisabled,
  }

  const relTcrTitle = `${tcrTitle} enabled badges`
  const relMetadata = {
    tcrTitle: relTcrTitle,
    tcrDescription: `A List of lists related to ${tcrTitle}`,
    columns: relColumns,
    itemName: relItemName.toLowerCase(),
    itemNamePlural: relItemNamePlural.toLowerCase(),
    isConnectedTCR: true,
    requireRemovalEvidence: true,
    isTCRofTCRs: true,
    parentTCRAddress,
    relTcrDisabled: true,
  }

  const commonMetaEvidenceProps = {
    category: 'Curated Lists',
    question: `Does the ${
      (itemName && itemName.toLowerCase()) || 'item'
    } comply with the required criteria?`,
    fileURI: tcrPrimaryDocument,
    evidenceDisplayInterfaceURI,
    metadata,
  }

  const commonRelMetaEvidenceProps = {
    ...commonMetaEvidenceProps,
    question: `Does the ${relItemName} comply with the required criteria?`,
    fileURI: relTcrDisabled
      ? process.env.REACT_APP_REJECT_ALL_POLICY_URI
      : relTcrPrimaryDocument,
    metadata: relMetadata,
    _v: '1.0.0',
    evidenceDisplayInterfaceRequiredParams: [
      'disputeID',
      'arbitrableContractAddress',
      'arbitratorContractAddress',
      'arbitrableChainID',
      'arbitrableJsonRpcUrl',
    ],
  }

  const registrationMetaEvidence = {
    name: 'reg-meta-evidence.json',
    data: {
      title: `Add ${
        itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'
      } to ${tcrTitle}`,
      description: `Someone requested to add ${
        itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'
      } to ${tcrTitle}`,
      rulingOptions: {
        titles: ['Yes, Add It', "No, Don't Add It"],
        descriptions: [
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } complies with the required criteria and should be added.`,
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } does not comply with the required criteria and should not be added.`,
        ],
      },
      ...commonMetaEvidenceProps,
    },
  }
  const clearingMetaEvidence = {
    name: 'clr-meta-evidence.json',
    data: {
      title: `Remove ${
        itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'
      } from ${tcrTitle}`,
      description: `Someone requested to remove ${
        itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'
      } from ${tcrTitle}`,
      rulingOptions: {
        titles: ['Yes, Remove It', "No, Don't Remove It"],
        descriptions: [
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } does not comply with the required criteria and should be removed.`,
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } complies with the required criteria and should not be removed.`,
        ],
      },
      ...commonMetaEvidenceProps,
    },
  }

  const relRegistrationMetaEvidence = {
    name: 'rel-reg-meta-evidence.json',
    data: {
      title: `Add a ${relItemName} to ${relTcrTitle}`,
      description: `Someone requested to add a ${relItemName} to ${relTcrTitle}.`,
      rulingOptions: {
        titles: ['Yes, Add It', "No, Don't Add It"],
        descriptions: [
          `Select this if you think the ${relItemName} complies with the required criteria and should be added.`,
          `Select this if you think the ${relItemName} does not comply with the required criteria and should not be added.`,
        ],
      },
      ...commonRelMetaEvidenceProps,
    },
  }
  const relClearingMetaEvidence = {
    name: 'rel-clr-meta-evidence.json',
    data: {
      title: `Remove a ${relItemName} from ${relTcrTitle}`,
      description: `Someone requested to remove a ${relItemName} from ${relTcrTitle}.`,
      rulingOptions: {
        titles: ['Yes, Remove It', "No, Don't Remove It"],
        descriptions: [
          `Select this if you think the ${relItemName} does not comply with the required criteria and should be removed.`,
          `Select this if you think the ${relItemName} complies with the required criteria and should not be removed.`,
        ],
      },
      ...commonRelMetaEvidenceProps,
    },
  }

  const files = [
    registrationMetaEvidence,
    clearingMetaEvidence,
    relRegistrationMetaEvidence,
    relClearingMetaEvidence,
  ].map(
    ({ name, data }) =>
      new File([JSON.stringify(data)], name, { type: 'application/json' }),
  )

  const uploaded = await Promise.all(
    files.map((file) => uploadFile(file, JSON_UPLOAD_ROLE)),
  )
  if (uploaded.some((p) => !p))
    throw new Error('Failed to upload meta-evidence to IPFS.')
  const [
    registrationMetaEvidencePath,
    clearingMetaEvidencePath,
    relRegistrationMetaEvidencePath,
    relClearingMetaEvidencePath,
  ] = uploaded as string[]

  return {
    registrationMetaEvidencePath,
    clearingMetaEvidencePath,
    relRegistrationMetaEvidencePath,
    relClearingMetaEvidencePath,
  }
}

/* ---------- Layout ---------- */

const Review = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
  margin: 0;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const ReviewRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  min-height: 60px;
  padding: 10px 0;
  border-bottom: 1px solid var(--glass-border);

  dt {
    grid-column: 1;
  }

  dd {
    grid-column: 1;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd[data-empty='true'] {
    color: var(--color-faint);
    font-weight: 400;
  }

  /* An address shown in full, on two lines where it must. */
  dd[data-wrap='true'] {
    overflow: visible;
    white-space: normal;
  }

  button {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
`

/** An address in the review: Geist Mono, whole, breaking anywhere on a phone. */
const AddressText = styled.span`
  font-family: var(--font-mono);
  font-size: var(--fs-data);
  font-weight: 400;
  overflow-wrap: anywhere;
`

const EditButton = styled.button`
  padding: 4px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-primary);
  font-size: var(--fs-small);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--motion);

  &:hover {
    background: var(--color-primary-soft);
  }
`

const ActionArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
`

type DeployPhase = 'idle' | 'uploading' | 'wallet' | 'mining' | 'mined'

type DeployProps = Omit<StepProps, 'postSubmit'> & {
  /** Jump back to a visual step by its title ("Name", "Fields"…). */
  onEditStep?: (stepTitle: string) => void
}

const META_EVIDENCE_LABELS = [
  'Add rules',
  'Remove rules',
  'Badges add rules',
  'Badges remove rules',
]

const Deploy = ({
  setTxState,
  tcrState,
  setTcrState,
  onEditStep,
}: DeployProps) => {
  const urlChainId = useUrlChainId()
  const walletChainId = useChainId()
  const chainId = urlChainId ?? walletChainId
  const chainName =
    NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]?.name ??
    `chain ${chainId}`
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  // The list's own chain, to check a deployment again after a reload, when
  // the wallet may not be back yet or may sit on another chain.
  const receiptClient = usePublicClient({ chainId })
  const { data: walletClient } = useWalletClient()
  const nativeCurrency = useNativeCurrency()
  // A deployment sent before this page reloaded, kept with the draft until
  // it is mined or fails: it reopens on its confirmations, to be checked
  // again, instead of offering to deploy a second list.
  const restored = tcrState.pendingDeploy
  const [phase, setPhase] = useState<DeployPhase>(restored ? 'mining' : 'idle')
  const [txSubmitted, setTxSubmitted] = useState<string>()
  const [deployedTCRAddress, setDeployedTCRAddress] = useState<string>()
  const [pendingHash, setPendingHash] = useState<Hash | undefined>(
    restored?.hash as Hash | undefined,
  )
  // Sent, but no receipt came back (viem stops waiting after three minutes,
  // or the node failed): it may still be mined, so it is not a failure, and
  // deploying again could make a second list.
  const [stillPending, setStillPending] = useState(!!restored)
  // A wait for the receipt ended without one. Only then is deploying again
  // offered, beside "Check again": a deployment restored after a reload is
  // checked first.
  const [waited, setWaited] = useState(false)
  const [metaEvidencePaths, setMetaEvidencePaths] = useState<string[]>([])
  const [predicted, setPredicted] = useState<
    | {
        list: string
        badges: string
      }
    | undefined
  >(restored ? { list: restored.list, badges: restored.badges } : undefined)
  const [failedAt, setFailedAt] = useState<DeployPhase>()
  const factoryAddress = lgtcrFactoryAddresses[chainId]
  const defaultTCRAddress = defaultTcrAddresses[chainId]
  const batcherAddress = txBatcherAddresses[chainId]
  const evidenceDisplayInterfaceURI = defaultEvidenceDisplayUri[chainId]
  const { submissionDeposit, metaEvidence } = useStandardTcrView(
    defaultTCRAddress ?? '',
  )
  const { uploadFile } = useAtlasProvider()
  const gate = useWalletGate({ verb: 'deploy', needsChain: true })

  const incomplete = useMemo(() => incompleteSteps(tcrState), [tcrState])
  const busy = phase === 'uploading' || phase === 'wallet' || phase === 'mining'
  const configured =
    !!factoryAddress && !!batcherAddress && !!evidenceDisplayInterfaceURI
  const arbitratorCheck = useArbitratorCheck(
    chainId,
    tcrState.arbitratorAddress,
    tcrState.arbitratorExtraData,
    chainName,
  )
  const badgesArbitratorCheck = useArbitratorCheck(
    chainId,
    tcrState.relTcrDisabled ? undefined : tcrState.relArbitratorAddress,
    tcrState.relArbitratorExtraData,
    chainName,
  )
  const arbitratorBlocker =
    arbitratorCheck.checking || badgesArbitratorCheck.checking
      ? 'Checking the arbitrator'
      : (arbitratorCheck.problem ??
        (badgesArbitratorCheck.problem
          ? `Badges list: ${badgesArbitratorCheck.problem}`
          : undefined))
  const blocker = !configured
    ? `Lists cannot be deployed on ${chainName}: no factory is configured`
    : incomplete.length > 0
      ? `Complete ${listInProse(incomplete)} before deploying`
      : (arbitratorBlocker ?? gate.blocker)
  // Only the wallet stands in the way: its fix becomes the primary action.
  const walletFix =
    !busy &&
    configured &&
    incomplete.length === 0 &&
    !arbitratorBlocker &&
    gate.blocker
      ? gate.fix
      : undefined

  const listOfListsTitle = metaEvidence?.metadata?.tcrTitle || 'Curated Lists'
  const listOfListsDeposit = formatNative(submissionDeposit)
  const court = useCourtSummary(
    chainId,
    tcrState.arbitratorAddress,
    tcrState.arbitratorExtraData,
  )
  const periodHours = typedNumber(tcrState.challengePeriodDuration)
  const period =
    Number.isFinite(periodHours) && periodHours > 0
      ? formatDurationLong(periodHours * 60 * 60)
      : '—'

  /** Keeps a sent deployment with the draft (saved at once), or forgets it. */
  const keepPending = (pendingDeploy?: TcrState['pendingDeploy']) =>
    setTcrState((previous) => ({ ...previous, pendingDeploy }))

  const onDeploy = async () => {
    if (
      !factoryAddress ||
      !batcherAddress ||
      !evidenceDisplayInterfaceURI ||
      !publicClient ||
      !walletClient
    ) {
      errorToast(
        !publicClient || !walletClient
          ? 'Your wallet is not ready. Reconnect it and try again.'
          : `No factory is configured for ${chainName}.`,
      )
      return
    }
    const factory = factoryAddress as Address
    const batcher = batcherAddress as Address
    // Which stage a failure belongs to, for the stepper.
    let stage: DeployPhase = 'uploading'
    // A deployment kept from before stays kept (in the draft too) until a
    // new one is sent: a retry cancelled or failed before the wallet sends
    // it must not forget the first, which may still go through.
    const previous = pendingHash ? { hash: pendingHash, predicted } : undefined
    const restorePrevious = () => {
      if (!previous) return false
      setPendingHash(previous.hash)
      setPredicted(previous.predicted)
      setStillPending(true)
      setWaited(true)
      setFailedAt(undefined)
      setPhase('mining')
      return true
    }
    setFailedAt(undefined)
    setPendingHash(undefined)
    setStillPending(false)
    setWaited(false)
    setMetaEvidencePaths([])
    setPredicted(undefined)
    try {
      setPhase('uploading')
      const txCount = await publicClient.getTransactionCount({
        address: factory,
      })
      const parentTCRAddress = getContractAddress({
        from: factory,
        nonce: BigInt(txCount + 1),
      })

      const {
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
      } = await getTcrMetaEvidence(
        tcrState,
        parentTCRAddress,
        evidenceDisplayInterfaceURI,
        uploadFile,
      )
      setMetaEvidencePaths([
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
      ])
      // Uploaded: from here on a failure belongs to the transaction.
      stage = 'wallet'
      setPhase('wallet')

      const skipped = !!tcrState.relTcrDisabled
      // A skipped badges list is never validated (its step has nothing to
      // check), so its placeholder takes the list's own arbitrator, extra
      // data and governor, which were: a half-edited hidden field must not
      // fail the deploy after the sign-in and the uploads.
      const relTCRArgs = [
        skipped ? tcrState.arbitratorAddress : tcrState.relArbitratorAddress,
        skipped
          ? tcrState.arbitratorExtraData
          : tcrState.relArbitratorExtraData,
        ZERO_ADDRESS,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
        skipped ? tcrState.governorAddress : tcrState.relGovernorAddress,
        [
          skipped
            ? parseEther('10000000000000')
            : toWei(tcrState.relSubmissionBaseDeposit),
          relWei(tcrState.relRemovalBaseDeposit, skipped),
          relWei(tcrState.relSubmissionChallengeBaseDeposit, skipped),
          relWei(tcrState.relRemovalChallengeBaseDeposit, skipped),
        ],
        relWhole(tcrState.relChallengePeriodDuration, 60 * 60, skipped),
        // Percent to basis points, exactly as typed (12.5% is 1250).
        [
          relWhole(tcrState.relSharedStakeMultiplier, 100, skipped),
          relWhole(tcrState.relWinnerStakeMultiplier, 100, skipped),
          relWhole(tcrState.relLoserStakeMultiplier, 100, skipped),
        ],
        ZERO_ADDRESS,
      ]

      const relData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: relTCRArgs,
      })
      const relTCRAddress = getContractAddress({
        from: factory,
        nonce: BigInt(txCount),
      })
      setPredicted({ list: parentTCRAddress, badges: relTCRAddress })

      const TCRArgs = [
        tcrState.arbitratorAddress,
        tcrState.arbitratorExtraData,
        relTCRAddress,
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        tcrState.governorAddress,
        [
          toWei(tcrState.submissionBaseDeposit),
          toWei(tcrState.removalBaseDeposit),
          toWei(tcrState.submissionChallengeBaseDeposit),
          toWei(tcrState.removalChallengeBaseDeposit),
        ],
        toWhole(tcrState.challengePeriodDuration, 60 * 60),
        [
          toWhole(tcrState.sharedStakeMultiplier, 100),
          toWhole(tcrState.winnerStakeMultiplier, 100),
          toWhole(tcrState.loserStakeMultiplier, 100),
        ],
        ZERO_ADDRESS,
      ]
      const tcrData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: TCRArgs,
      })

      // Both addresses were predicted from the factory's nonce before the
      // uploads (the badges file names its parent list). A list deployed by
      // anyone since would shift them, and the batch would still go through
      // with this list pointing at someone else's badges list: start over.
      const nonceNow = await publicClient.getTransactionCount({
        address: factory,
      })
      if (nonceNow !== txCount)
        throw new Error(
          'Another list was just deployed through the same factory, so the addresses prepared for this one are taken. Deploy again: its files are prepared afresh.',
        )

      const targets = [factory, factory]
      const values = [0n, 0n]
      const datas = [relData, tcrData]

      const { request } = await simulateContract(wagmiConfig, {
        address: batcher,
        abi: _txBatcher,
        functionName: 'batchSend',
        args: [targets, values, datas],
        gas: 8000000n,
        account,
      })

      const result = await wrapWithToast(
        () =>
          walletClient.writeContract(request).then((hash) => {
            // Signed: show the hash while the confirmations come in, and
            // keep it with the draft for a reload in the meantime.
            stage = 'mining'
            setPendingHash(hash)
            setPhase('mining')
            keepPending({ hash, list: parentTCRAddress, badges: relTCRAddress })
            return hash
          }),
        publicClient,
        {
          // The page has its own pending step (Check again, Deploy again).
          waitForLate: false,
          // Sped up in the wallet: the page and the draft follow the new
          // hash, which a reload or Check again must wait for.
          onHash: (next) => {
            setPendingHash(next)
            keepPending({
              hash: next,
              list: parentTCRAddress,
              badges: relTCRAddress,
            })
          },
        },
      )

      if (result.status && result.result)
        onMined(result.result, parentTCRAddress, relTCRAddress)
      // Sent (the callback above moved the stage on), but no receipt, which
      // a revert would have: the transaction is still pending. Unless the
      // wallet cancelled or replaced it: then it never will be.
      else if (
        (stage as DeployPhase) === 'mining' &&
        !result.result &&
        !result.replaced
      ) {
        setStillPending(true)
        setWaited(true)
      } else {
        // Reverted on chain, or cancelled: nothing is pending any more. A
        // retry the wallet refused goes back to the deployment kept before.
        if ((stage as DeployPhase) === 'mining') keepPending(undefined)
        else if (restorePrevious()) return
        setFailedAt(stage)
        setPhase('idle')
      }
    } catch (err) {
      console.error('Error deploying list:', err)
      errorToast(parseWagmiError(err))
      if ((stage as DeployPhase) !== 'mining' && restorePrevious()) return
      setFailedAt(stage)
      setPhase('idle')
    }
  }

  /** The deployment is mined: the list's address, saved with the transaction. */
  const onMined = (
    receipt: TransactionReceipt,
    predictedAddress: string,
    predictedBadges?: string,
  ) => {
    const txHash = receipt.transactionHash
    setTxSubmitted(txHash)

    // Find the deployed contract address from the receipt logs
    let contractAddress: string = predictedAddress // fallback to predicted address
    try {
      const newGTCRLogs = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({
              abi: _GTCRFactory,
              data: log.data,
              topics: log.topics,
            })
          } catch {
            return null
          }
        })
        .filter(
          (parsed): parsed is NonNullable<typeof parsed> =>
            !!parsed && parsed.eventName === 'NewGTCR',
        )
      // The second NewGTCR event is the parent TCR
      const pickAddress = (args: unknown): string | undefined =>
        args && typeof args === 'object' && '_address' in args
          ? ((args as { _address?: string })._address ?? undefined)
          : undefined
      if (newGTCRLogs.length >= 2) {
        contractAddress = pickAddress(newGTCRLogs[1].args) ?? contractAddress
        // A deploy that slipped in after the check above shifts the
        // addresses: say so, with the way to repair it.
        const badges = pickAddress(newGTCRLogs[0].args)
        if (
          badges &&
          predictedBadges &&
          badges.toLowerCase() !== predictedBadges.toLowerCase()
        )
          errorToast(
            `Another list was deployed in the same block, so this list's badges point at ${predictedBadges} instead of the badges list deployed with it (${badges}). Its governor can repair this with changeConnectedTCR.`,
          )
      } else if (newGTCRLogs.length === 1)
        contractAddress = pickAddress(newGTCRLogs[0].args) ?? contractAddress
    } catch (err) {
      console.error('Error parsing deploy logs:', err)
    }

    setTxState({
      txHash,
      networkId: chainId,
      status: 'mined',
      contractAddress,
    })
    setTcrState((prevState) => ({
      ...prevState,
      finished: true,
      pendingDeploy: undefined,
    }))
    setPhase('mined')
    setDeployedTCRAddress(contractAddress)
  }

  /** Waits for the same transaction again; nothing new is sent. */
  const checkAgain = async () => {
    if (!receiptClient || !pendingHash) return
    setStillPending(false)
    try {
      const { receipt, replacement } = await waitForOutcome(
        receiptClient,
        pendingHash,
      )
      // viem answers a replaced transaction with its replacement's receipt,
      // which succeeded: a cancel from the wallet, or another transaction in
      // its place, deployed nothing, and the predicted addresses hold no
      // list. Only a speed-up did.
      const replaced = !!replacement && replacement.reason !== 'repriced'
      if (receipt.status === 'success' && !replaced)
        onMined(receipt, predicted?.list ?? '', predicted?.badges)
      else {
        keepPending(undefined)
        setFailedAt('mining')
        setPhase('idle')
      }
    } catch (err) {
      console.error('Error waiting for the deploy transaction:', err)
      setStillPending(true)
      setWaited(true)
    }
  }

  const shownHash = txSubmitted ?? pendingHash
  const explorerTxUrl = shownHash
    ? `${getExplorerUrl(chainId)}/tx/${shownHash}`
    : undefined
  const explorerAddressUrl = deployedTCRAddress
    ? `${getExplorerUrl(chainId)}/address/${deployedTCRAddress}`
    : undefined

  const order: DeployPhase[] = ['uploading', 'wallet', 'mining', 'mined']
  const reached = order.indexOf(phase)
  const stepStatus = (stage: DeployPhase): TxStatus => {
    if (phase === 'idle') {
      // After a failure, show how far the last attempt got.
      if (!failedAt) return 'upcoming'
      const failed = order.indexOf(failedAt)
      const at = order.indexOf(stage)
      return at < failed ? 'done' : at === failed ? 'failed' : 'upcoming'
    }
    const at = order.indexOf(stage)
    if (phase === 'mined' || at < reached) return 'done'
    return at === reached ? 'active' : 'upcoming'
  }
  const liveStatus: TxStatus = phase === 'mined' ? 'done' : 'upcoming'
  const failedNote =
    failedAt && phase === 'idle'
      ? failedAt === 'uploading'
        ? 'The upload failed, so nothing was deployed. Try again.'
        : 'The transaction was not sent, so nothing was deployed. Try again when ready.'
      : undefined

  const fieldNames = tcrState.isTCRofTCRs
    ? 'List address (a list of lists)'
    : tcrState.columns
        .map((column) => column.label)
        .filter(Boolean)
        .join(', ')
  const reviewRows: {
    label: string
    value: React.ReactNode
    empty?: boolean
    /** A value that wraps instead of being cut: a whole address. */
    wrap?: boolean
    step: string
  }[] = [
    {
      label: 'Name',
      value: tcrState.tcrTitle || 'Not set',
      empty: !tcrState.tcrTitle,
      step: 'Name',
    },
    {
      label: 'Policy',
      value: tcrState.tcrPrimaryDocument ? 'Uploaded' : 'Not uploaded',
      empty: !tcrState.tcrPrimaryDocument,
      step: 'Policy',
    },
    {
      label: 'Entries',
      value: `${tcrState.itemName || '—'} / ${tcrState.itemNamePlural || '—'}`,
      step: 'Item name',
    },
    {
      label: 'Fields',
      value: fieldNames || 'None named',
      empty: !fieldNames,
      step: 'Fields',
    },
    {
      label: 'Submission deposit',
      value: `${plainDecimal(tcrState.submissionBaseDeposit)} ${nativeCurrency} + arbitration cost`,
      step: 'Deposit',
    },
    {
      label: 'Challenge period',
      value: period,
      step: 'Deposit',
    },
    ...(!court.isKleros
      ? [
          {
            label: 'Arbitrator',
            // In full: the creator checks what they deploy.
            value: tcrState.arbitratorAddress ? (
              <AddressText>{tcrState.arbitratorAddress}</AddressText>
            ) : (
              'Not set'
            ),
            empty: !tcrState.arbitratorAddress,
            wrap: true,
            step: 'Deposit',
          },
        ]
      : []),
    ...(court.courtName && court.jurors !== undefined
      ? [
          {
            label: 'Court',
            value: `${court.courtName} · ${court.jurors} ${court.jurors === 1 ? 'juror' : 'jurors'} in the first round`,
            step: 'Deposit',
          },
        ]
      : []),
    // Who can change the list later. The field sits under Advanced, so the
    // review names it in full, and says when it is not the connected wallet.
    {
      label: 'Governor',
      value: tcrState.governorAddress ? (
        <>
          <AddressText>{tcrState.governorAddress}</AddressText>
          {account &&
          tcrState.governorAddress.toLowerCase() === account.toLowerCase()
            ? ' (your wallet)'
            : ' (not your wallet)'}
        </>
      ) : (
        'Not set'
      ),
      empty: !tcrState.governorAddress,
      wrap: true,
      step: 'Deposit',
    },
    {
      label: 'Badges list',
      value: tcrState.relTcrDisabled ? 'Skipped' : 'Included',
      step: 'Badges',
    },
  ]

  return (
    <>
      <StepBody>
        <StepHeader
          heading={phase === 'mined' ? 'List deployed' : 'Review and deploy'}
          lede={
            phase === 'mined'
              ? 'The list is live; it is also saved in this browser under your deployments.'
              : 'Check the details, then sign one transaction: you pay gas only, submitters pay deposits later.'
          }
        />

        {phase === 'idle' && (
          <Review aria-label="Review">
            {reviewRows.map((row) => (
              <ReviewRow key={row.label}>
                <Label as="dt" $tone="faint">
                  {row.label}
                </Label>
                <dd
                  data-empty={row.empty || undefined}
                  data-wrap={row.wrap || undefined}
                  title={typeof row.value === 'string' ? row.value : undefined}
                >
                  {row.value}
                </dd>
                {onEditStep && (
                  <EditButton
                    type="button"
                    aria-label={`Edit ${row.label.toLowerCase()}`}
                    onClick={() => onEditStep(row.step)}
                  >
                    Edit
                  </EditButton>
                )}
              </ReviewRow>
            ))}
          </Review>
        )}

        <Stack $gap={14}>
          <Label $tone="faint">
            {phase === 'idle' ? 'What deploying does' : 'Deployment'}
          </Label>
          <TxList aria-label="Deployment steps">
            <TxStep
              index={0}
              number={1}
              status={stepStatus('uploading')}
              title="Upload the list details"
              tag="IPFS"
              note={
                stepStatus('uploading') === 'failed'
                  ? failedNote
                  : 'Four small files: the add and remove rules for your list and its badges list.'
              }
            >
              {metaEvidencePaths.length > 0 && (
                <TxData>
                  {metaEvidencePaths.map((path, index) => (
                    <TxLink
                      key={path}
                      href={parseIpfs(path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={path}
                    >
                      <span>{META_EVIDENCE_LABELS[index]}</span>
                      {truncateMiddle(
                        path.replace(/^\/?ipfs\//, '').split('/')[0],
                        6,
                        4,
                      )}
                    </TxLink>
                  ))}
                </TxData>
              )}
            </TxStep>
            <TxStep
              index={1}
              number={2}
              status={stepStatus('wallet')}
              title="Sign one transaction"
              tag="Gas only"
              note={
                stepStatus('wallet') === 'failed'
                  ? failedNote
                  : `Confirm in your wallet. It batches two deployments: the badges list${tcrState.relTcrDisabled ? ' (a closed placeholder, since you skipped it)' : ''}, then your list.`
              }
            >
              {predicted && (
                <TxData>
                  <TxPill title={predicted.list}>
                    <span>Your list</span>
                    {truncateMiddle(predicted.list, 6, 4)}
                  </TxPill>
                  <TxPill title={predicted.badges}>
                    <span>Badges list</span>
                    {truncateMiddle(predicted.badges, 6, 4)}
                  </TxPill>
                </TxData>
              )}
            </TxStep>
            <TxStep
              index={2}
              number={3}
              status={stepStatus('mining')}
              title="Wait for two confirmations"
              note={
                stepStatus('mining') === 'failed'
                  ? 'The transaction did not go through; nothing was deployed.'
                  : stillPending && !waited
                    ? 'Sent before this page reloaded: check whether it went through.'
                    : stillPending
                      ? 'Not mined yet, but it may still go through: follow it on the explorer before deploying again.'
                      : 'Keep this page open until the transaction is mined.'
              }
            >
              {shownHash && explorerTxUrl && (
                <TxData>
                  <TxLink
                    href={explorerTxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={shownHash}
                  >
                    <span>Transaction</span>
                    {truncateMiddle(shownHash, 8, 6)}
                    <CurateIcon name="external" size={12} />
                  </TxLink>
                </TxData>
              )}
            </TxStep>
            <TxStep
              index={3}
              number={4}
              status={liveStatus}
              title="The list goes live"
            >
              {phase === 'mined' && deployedTCRAddress && (
                <TxData>
                  {explorerAddressUrl ? (
                    <TxLink
                      href={explorerAddressUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={deployedTCRAddress}
                    >
                      <span>Address</span>
                      {truncateMiddle(deployedTCRAddress, 8, 6)}
                      <CurateIcon name="external" size={12} />
                    </TxLink>
                  ) : (
                    <TxPill title={deployedTCRAddress}>
                      <span>Address</span>
                      {truncateMiddle(deployedTCRAddress, 8, 6)}
                    </TxPill>
                  )}
                </TxData>
              )}
            </TxStep>
            <TxStep
              index={4}
              number={5}
              status="upcoming"
              title={`Submit it to ${listOfListsTitle}`}
              tag={
                listOfListsDeposit
                  ? `Optional · ${listOfListsDeposit} ${nativeCurrency} deposit`
                  : 'Optional'
              }
              last
            />
          </TxList>
        </Stack>

        {phase !== 'mined' && (
          <ActionArea>
            <Row $gap={10} $wrap>
              {stillPending ? (
                <>
                  <Button type="button" $variant="primary" onClick={checkAgain}>
                    Check again
                  </Button>
                  {/* After a wait that found no receipt: a dropped transaction must not lock the draft. */}
                  {waited && !blocker && (
                    <Button
                      type="button"
                      $variant="secondary"
                      onClick={onDeploy}
                    >
                      Deploy again
                    </Button>
                  )}
                </>
              ) : walletFix ? (
                <Button
                  type="button"
                  $variant="primary"
                  disabled={walletFix.loading}
                  onClick={walletFix.onClick}
                >
                  {walletFix.loading ? 'Waiting…' : walletFix.label}
                </Button>
              ) : (
                <Button
                  type="button"
                  $variant="primary"
                  disabled={!!blocker || busy}
                  aria-disabled={!!blocker || busy}
                  title={blocker || undefined}
                  onClick={onDeploy}
                >
                  {phase === 'uploading'
                    ? 'Uploading…'
                    : phase === 'wallet'
                      ? 'Waiting for your signature…'
                      : phase === 'mining'
                        ? 'Confirming…'
                        : failedAt
                          ? 'Deploy again'
                          : 'Deploy the list'}
                </Button>
              )}
            </Row>
            {blocker && !busy && !walletFix && (
              <Row $gap={8} role="status">
                <StatusDot $tone="neutral" aria-hidden />
                <Small $muted>{blocker}</Small>
              </Row>
            )}
            {busy && (
              <Row $gap={8} role="status">
                <StatusDot $tone="window" aria-hidden />
                <Small $muted>
                  {phase === 'uploading'
                    ? 'Uploading the list details to IPFS'
                    : phase === 'wallet'
                      ? 'Confirm the transaction in your wallet'
                      : stillPending && !waited
                        ? 'Check whether the transaction went through'
                        : stillPending
                          ? 'The transaction is still pending'
                          : 'Waiting for the transaction to be mined'}
                </Small>
              </Row>
            )}
          </ActionArea>
        )}

        {phase === 'mined' && deployedTCRAddress && (
          <ActionArea>
            <Row $gap={8} role="status">
              <StatusDot $tone="registered" aria-hidden />
              <Small>Deployed</Small>
              <Data $mono $muted $weight={400} title={deployedTCRAddress}>
                {truncateMiddle(deployedTCRAddress, 10, 8)}
              </Data>
            </Row>
            <Row $gap={10} $wrap>
              <ButtonLink
                to={`/tcr/${chainId}/${deployedTCRAddress}`}
                $variant="primary"
              >
                Open the list
              </ButtonLink>
              {defaultTCRAddress && (
                // Its submit page, with the new list's address as the first
                // value (a list of lists' column), as the Stake deploy's.
                <ButtonLink
                  to={`/tcr/${chainId}/${defaultTCRAddress}/submit?address=${deployedTCRAddress}`}
                  $variant="secondary"
                >
                  Submit it to {listOfListsTitle}
                </ButtonLink>
              )}
            </Row>
          </ActionArea>
        )}
      </StepBody>
    </>
  )
}

export default Deploy
