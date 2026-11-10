import React, { useMemo, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import {
  parseEther,
  encodeFunctionData,
  getContractAddress,
  decodeEventLog,
  type Address,
} from 'viem'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _GTCRFactory from 'assets/abis/LightGTCRFactory.json'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { ZERO_ADDRESS, isVowel } from 'utils/string'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { formatDurationLong } from 'utils/time'
import { parseIpfs } from 'utils/ipfs-parse'
import { wagmiConfig } from 'config/wagmi'
import { NETWORKS_INFO, getExplorerUrl } from 'config/networks'
import useUrlChainId from 'hooks/use-url-chain-id'
import useLightTcrView from 'hooks/light-tcr-view'
import useNativeCurrency from 'hooks/native-currency'
import SubmitModal from '../light-item-details/modals/submit'
import {
  defaultEvidenceDisplayUri,
  defaultTcrAddresses,
  lgtcrFactoryAddresses,
  txBatcherAddresses,
} from 'config/tcr-addresses'
import { CurateIcon } from 'components/curate/icons'
import { reveal } from 'components/curate/motion/reveal'
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
import { StepBody, StepHeader, formatNative, useWalletGate } from './fields'
import { incompleteSteps, listInProse } from './schemas'
import { useCourtSummary } from './court'
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
    columns,
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
          ? isVowel(itemName[0])
            ? `an ${itemName.toLowerCase()}`
            : `a ${itemName.toLowerCase()}`
          : 'an item'
      } to ${tcrTitle}`,
      description: `Someone requested to add ${
        itemName
          ? isVowel(itemName[0])
            ? `an ${itemName.toLowerCase()}`
            : `a ${itemName.toLowerCase()}`
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
          ? isVowel(itemName[0])
            ? `an ${itemName.toLowerCase()}`
            : `a ${itemName.toLowerCase()}`
          : 'an item'
      } from ${tcrTitle}`,
      description: `Someone requested to remove ${
        itemName
          ? isVowel(itemName[0])
            ? `an ${itemName.toLowerCase()}`
            : `a ${itemName.toLowerCase()}`
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

const spin = keyframes`
  to { transform: rotate(360deg); }
`

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

  button {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
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

type TxStatus = 'upcoming' | 'active' | 'done' | 'failed'

const TxList = styled.ol`
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`

const TxItem = styled.li<{ $status: TxStatus; $last?: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 14px;
  padding-bottom: ${({ $last }) => ($last ? 0 : '22px')};
  ${reveal}

  /* The connector to the next step fills once this one is done. */
  &::before,
  &::after {
    content: ${({ $last }) => ($last ? 'none' : "''")};
    position: absolute;
    top: 36px;
    bottom: 4px;
    left: 15px;
    width: 2px;
    border-radius: var(--radius-pill);
  }

  &::before {
    background: var(--glass-border);
  }

  &::after {
    background: linear-gradient(var(--color-primary), var(--aurora-b));
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--color-primary) 60%, transparent);
    transform-origin: top;
    transform: scaleY(${({ $status }) => ($status === 'done' ? 1 : 0)});
    transition: transform 700ms var(--ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      transition: none;
    }
  }
`

const txMarker = {
  upcoming: css`
    border-color: var(--glass-border);
    background: var(--color-surface);
    color: var(--color-faint);
  `,
  active: css`
    border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
    background: var(--color-primary-soft);
    color: var(--color-primary);
    box-shadow: 0 0 0 5px
      color-mix(in srgb, var(--color-primary) 10%, transparent);
  `,
  done: css`
    border-color: color-mix(in srgb, var(--color-primary) 60%, transparent);
    background: var(--color-primary-fill);
    color: var(--color-on-primary);
    box-shadow: 0 6px 18px -8px var(--color-primary);
  `,
  failed: css`
    border-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
    background: var(--color-danger-soft);
    color: var(--color-danger);
  `,
}

const TxMarker = styled.span<{ $status: TxStatus }>`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    background 320ms var(--ease-out),
    border-color 320ms var(--ease-out),
    box-shadow 320ms var(--ease-out),
    color 320ms var(--ease-out);
  ${({ $status }) => txMarker[$status]}
`

const Spinner = styled.i`
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-pill);
  animation: ${spin} 800ms linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2400ms;
  }
`

const TxBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 5px;
`

const TxTitle = styled.span<{ $status: TxStatus }>`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: ${({ $status }) =>
    $status === 'upcoming' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  font-weight: 500;
`

const TxNote = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const TxData = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 6px;
`

const HashLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
  transition:
    border-color var(--motion),
    background var(--motion);

  span {
    color: var(--color-muted);
    font-family: var(--font-sans);
  }

  &:hover {
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    background: var(--color-primary-soft);
  }
`

const AddressPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 12px;

  span {
    color: var(--color-muted);
    font-family: var(--font-sans);
  }
`

const TxTag = styled.span`
  color: var(--color-faint);
  font-size: var(--fs-small);
  font-weight: 400;
`

const ActionArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
`

const TxStep = ({
  number,
  status,
  title,
  tag,
  note,
  last,
  index,
  children,
}: {
  number: number
  status: TxStatus
  title: React.ReactNode
  tag?: React.ReactNode
  /** Shown only while the step runs or after it failed. */
  note?: React.ReactNode
  last?: boolean
  index: number
  children?: React.ReactNode
}) => (
  <TxItem
    $status={status}
    $last={last}
    style={{ ['--i' as string]: index }}
    aria-current={status === 'active' ? 'step' : undefined}
  >
    <TxMarker $status={status} aria-hidden>
      {status === 'done' ? (
        <CurateIcon name="check" size={15} />
      ) : status === 'active' ? (
        <Spinner />
      ) : status === 'failed' ? (
        <CurateIcon name="close" size={14} />
      ) : (
        number
      )}
    </TxMarker>
    <TxBody>
      <TxTitle $status={status}>
        {title}
        {tag && <TxTag>{tag}</TxTag>}
      </TxTitle>
      {note && (status === 'active' || status === 'failed') && (
        <TxNote>{note}</TxNote>
      )}
      {children}
    </TxBody>
  </TxItem>
)

type DeployPhase = 'idle' | 'uploading' | 'wallet' | 'mining' | 'mined'

type DeployProps = Omit<StepProps, 'postSubmit'> & {
  postSubmit?: () => void
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
  const { data: walletClient } = useWalletClient()
  const nativeCurrency = useNativeCurrency()
  const [phase, setPhase] = useState<DeployPhase>('idle')
  const [txSubmitted, setTxSubmitted] = useState<string>()
  const [deployedTCRAddress, setDeployedTCRAddress] = useState<string>()
  const [submissionFormOpen, setSubmissionFormOpen] = useState(false)
  const [pendingHash, setPendingHash] = useState<string>()
  const [metaEvidencePaths, setMetaEvidencePaths] = useState<string[]>([])
  const [predicted, setPredicted] = useState<{
    list: string
    badges: string
  }>()
  const [failedAt, setFailedAt] = useState<DeployPhase>()
  const factoryAddress = lgtcrFactoryAddresses[chainId]
  const defaultTCRAddress = defaultTcrAddresses[chainId]
  const batcherAddress = txBatcherAddresses[chainId]
  const evidenceDisplayInterfaceURI = defaultEvidenceDisplayUri[chainId]
  const {
    submissionDeposit,
    submissionBaseDeposit,
    arbitrationCost,
    metaEvidence,
    challengePeriodDuration,
  } = useLightTcrView(defaultTCRAddress ?? '')
  const { uploadFile } = useAtlasProvider()
  const gate = useWalletGate({ verb: 'deploy', needsChain: true })

  const incomplete = useMemo(() => incompleteSteps(tcrState), [tcrState])
  const busy = phase === 'uploading' || phase === 'wallet' || phase === 'mining'
  const configured =
    !!factoryAddress && !!batcherAddress && !!evidenceDisplayInterfaceURI
  const blocker = !configured
    ? `Lists cannot be deployed on ${chainName}: no factory is configured`
    : incomplete.length > 0
      ? `Complete ${listInProse(incomplete)} before deploying`
      : gate.blocker
  // Only the wallet stands in the way: its fix becomes the primary action.
  const walletFix =
    !busy && configured && incomplete.length === 0 && gate.blocker
      ? gate.fix
      : undefined

  const listOfListsTitle = metaEvidence?.metadata?.tcrTitle || 'Curated Lists'
  const listOfListsDeposit = formatNative(submissionDeposit)
  const court = useCourtSummary(
    chainId,
    tcrState.arbitratorAddress,
    tcrState.arbitratorExtraData,
  )
  const periodHours = Number(tcrState.challengePeriodDuration)
  const period =
    Number.isFinite(periodHours) && periodHours > 0
      ? formatDurationLong(periodHours * 60 * 60)
      : '—'

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
    setFailedAt(undefined)
    setPendingHash(undefined)
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

      const relTCRArgs = [
        tcrState.relArbitratorAddress,
        tcrState.relArbitratorExtraData,
        ZERO_ADDRESS,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
        tcrState.relGovernorAddress,
        [
          parseEther(
            tcrState.relTcrDisabled
              ? '10000000000000'
              : tcrState.relSubmissionBaseDeposit.toString(),
          ),
          parseEther(tcrState.relRemovalBaseDeposit.toString()),
          parseEther(tcrState.relSubmissionChallengeBaseDeposit.toString()),
          parseEther(tcrState.relRemovalChallengeBaseDeposit.toString()),
        ],
        Number(tcrState.relChallengePeriodDuration) * 60 * 60,
        [
          Math.ceil(Number(tcrState.relSharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.relWinnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.relLoserStakeMultiplier)) * 100,
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
          parseEther(tcrState.submissionBaseDeposit.toString()),
          parseEther(tcrState.removalBaseDeposit.toString()),
          parseEther(tcrState.submissionChallengeBaseDeposit.toString()),
          parseEther(tcrState.removalChallengeBaseDeposit.toString()),
        ],
        Number(tcrState.challengePeriodDuration) * 60 * 60,
        [
          Math.ceil(Number(tcrState.sharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.winnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.loserStakeMultiplier)) * 100,
        ],
        ZERO_ADDRESS,
      ]
      const tcrData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: TCRArgs,
      })

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
            // Signed: show the hash while the confirmations come in.
            stage = 'mining'
            setPendingHash(hash)
            setPhase('mining')
            return hash
          }),
        publicClient,
      )

      if (result.status && result.result) {
        const txHash = result.result.transactionHash
        setTxSubmitted(txHash)

        // Find the deployed contract address from the receipt logs
        let contractAddress: string = parentTCRAddress // fallback to predicted address
        try {
          const newGTCRLogs = result.result.logs
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
          if (newGTCRLogs.length >= 2)
            contractAddress =
              pickAddress(newGTCRLogs[1].args) ?? contractAddress
          else if (newGTCRLogs.length === 1)
            contractAddress =
              pickAddress(newGTCRLogs[0].args) ?? contractAddress
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
        }))
        setPhase('mined')
        setDeployedTCRAddress(contractAddress)
      } else {
        setFailedAt(stage)
        setPhase('idle')
      }
    } catch (err) {
      console.error('Error deploying list:', err)
      errorToast(parseWagmiError(err))
      setFailedAt(stage)
      setPhase('idle')
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
      value: `${String(tcrState.submissionBaseDeposit)} ${nativeCurrency} + arbitration cost`,
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
            value: tcrState.arbitratorAddress
              ? truncateMiddle(tcrState.arbitratorAddress, 8, 6)
              : 'Not set',
            empty: !tcrState.arbitratorAddress,
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
                    <HashLink
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
                    </HashLink>
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
                  <AddressPill title={predicted.list}>
                    <span>Your list</span>
                    {truncateMiddle(predicted.list, 6, 4)}
                  </AddressPill>
                  <AddressPill title={predicted.badges}>
                    <span>Badges list</span>
                    {truncateMiddle(predicted.badges, 6, 4)}
                  </AddressPill>
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
                  : 'Keep this page open until the transaction is mined.'
              }
            >
              {shownHash && explorerTxUrl && (
                <TxData>
                  <HashLink
                    href={explorerTxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={shownHash}
                  >
                    <span>Transaction</span>
                    {truncateMiddle(shownHash, 8, 6)}
                    <CurateIcon name="external" size={12} />
                  </HashLink>
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
                    <HashLink
                      href={explorerAddressUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={deployedTCRAddress}
                    >
                      <span>Address</span>
                      {truncateMiddle(deployedTCRAddress, 8, 6)}
                      <CurateIcon name="external" size={12} />
                    </HashLink>
                  ) : (
                    <AddressPill title={deployedTCRAddress}>
                      <span>Address</span>
                      {truncateMiddle(deployedTCRAddress, 8, 6)}
                    </AddressPill>
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
              {walletFix ? (
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
              {metaEvidence && submissionDeposit && defaultTCRAddress && (
                <Button
                  type="button"
                  $variant="secondary"
                  onClick={() => setSubmissionFormOpen(true)}
                >
                  Submit it to {listOfListsTitle}
                </Button>
              )}
            </Row>
          </ActionArea>
        )}
      </StepBody>
      {metaEvidence &&
        submissionDeposit &&
        challengePeriodDuration &&
        defaultTCRAddress && (
          <SubmitModal
            initialValues={deployedTCRAddress ? [deployedTCRAddress] : []}
            visible={!!submissionFormOpen}
            onCancel={() => setSubmissionFormOpen(false)}
            submissionDeposit={submissionDeposit}
            baseDeposit={submissionBaseDeposit}
            arbitrationCost={arbitrationCost}
            tcrAddress={defaultTCRAddress}
            metaEvidence={metaEvidence}
            challengePeriodDuration={challengePeriodDuration}
          />
        )}
    </>
  )
}

export default Deploy
