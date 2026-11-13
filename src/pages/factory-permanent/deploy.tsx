import React, { useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  parseUnits,
  decodeEventLog,
  type Address,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import _GTCRFactory from 'assets/abis/PermanentGTCRFactory.json'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { getArticleFor } from 'utils/string'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatDurationLong } from 'utils/time'
import { wagmiConfig } from 'config/wagmi'
import { NETWORKS_INFO, getExplorerUrl } from 'config/networks'
import {
  defaultEvidenceDisplayUriPermanent,
  defaultTcrAddresses,
  pgtcrFactoryAddresses,
} from 'config/tcr-addresses'
import useLightTcrView from 'hooks/light-tcr-view'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
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
  TxData,
  TxLink,
  TxList,
  TxPill,
  TxStep,
  type TxStatus,
} from 'components/curate/stake-factory-shell'
import { SafeImage, StepBody, StepHeader, useWalletGate } from './controls'
import { useCourtSummary } from './court'
import useArbitratorCheck from 'hooks/use-arbitrator-check'
import {
  effectivePercent,
  formatHours,
  formatMaybe,
  formatToken,
  groupAmount,
  hoursToSeconds,
  parseAmount,
  plainDecimal,
  readExtraData,
  shareOf,
  stakeProblem,
  stakeProblemText,
} from './format'
import { deployBlocker, deployProblems } from './schemas'
import type { StepProps, TcrState } from '.'

/*
 * The deploy step of the Stake factory: a review of every parameter the
 * factory will receive (each row jumps back to its step), then the
 * deployment as a transaction stepper: the IPFS upload of the list's
 * meta-evidence, the one signature (gas only), the confirmations with the
 * hash, the live list, and the optional submission to the list of lists.
 * Blockers name what stops the deploy. The meta-evidence and the factory
 * call are unchanged.
 */

const getTcrMetaEvidence = async (
  tcrState: TcrState,
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
  } = tcrState
  const metadata = {
    tcrTitle,
    tcrDescription,
    columns,
    itemName: itemName.toLowerCase(),
    itemNamePlural: itemNamePlural.toLowerCase(),
    logoURI: tcrLogo,
    requireRemovalEvidence: true,
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

  const metaEvidenceData = {
    title: `Keep ${
      itemName
        ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
        : 'an item'
    } in ${tcrTitle}`,
    description: `Someone requested to remove ${
      itemName
        ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
        : 'an item'
    } from ${tcrTitle}`,
    rulingOptions: {
      titles: ['Yes, Keep It Included', 'No, Remove It'],
      descriptions: [
        `Select this if you think the ${
          (itemName && itemName.toLowerCase()) || 'item'
        } complies with the required criteria and should be kept included.`,
        `Select this if you think the ${
          (itemName && itemName.toLowerCase()) || 'item'
        } does not comply with the required criteria and should be removed.`,
      ],
    },
    ...commonMetaEvidenceProps,
  }

  const metaEvidenceFile = new File(
    [JSON.stringify(metaEvidenceData)],
    'meta-evidence.json',
    { type: 'application/json' },
  )
  const ipfsMetaEvidencePath = await uploadFile(
    metaEvidenceFile,
    JSON_UPLOAD_ROLE,
  )
  if (!ipfsMetaEvidencePath)
    throw new Error('Failed to upload meta-evidence to IPFS.')

  return {
    ipfsMetaEvidencePath,
  }
}

const pickAddress = (args: unknown): string | undefined =>
  args && typeof args === 'object' && '_address' in args
    ? ((args as { _address?: string })._address ?? undefined)
    : undefined

type Phase = 'idle' | 'uploading' | 'wallet' | 'mining' | 'done'

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
  /* A row beside a taller one keeps its label and value together. */
  align-content: start;
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
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd[data-mono='true'] {
    font-family: var(--font-mono);
    font-size: var(--fs-data);
  }

  dd[data-empty='true'] {
    color: var(--color-faint);
    font-weight: 400;
  }

  dd[data-warning='true'] {
    grid-column: 1 / -1;
    overflow: visible;
    white-space: normal;
    font-weight: 400;
  }

  button {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
`

/** The logo row's value: a 24px thumbnail beside the word. */
const LogoValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  vertical-align: middle;
`

const LogoThumb = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--color-raised);
  color: var(--color-muted);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
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

const ActionArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
`

/* ---------- The step ---------- */

type DeployProps = StepProps & {
  /** Jump back to a visual step by its title; `advanced` opens the advanced options. */
  onEditStep?: (stepTitle: string, options?: { advanced?: boolean }) => void
}

type ReviewItem = {
  label: string
  value: React.ReactNode
  title?: string
  empty?: boolean
  mono?: boolean
  step: string
  advanced?: boolean
  /** A line under the value that must not be missed. */
  warning?: React.ReactNode
}

const Deploy = ({
  setTxState,
  tcrState,
  setTcrState,
  onEditStep,
}: DeployProps) => {
  const targetChainId = tcrState.chainId
  const { address: account } = useAccount()
  const { uploadFile } = useAtlasProvider()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const nativeCurrency = useNativeCurrency()
  const {
    symbol: tokenSymbol,
    decimals: tokenDecimals,
    decimalsRead,
    loading: loadingToken,
  } = useTokenSymbol(tcrState.tokenAddress || undefined)
  const tokenFound =
    !!tcrState.tokenAddress &&
    !loadingToken &&
    tokenSymbol !== 'tokens' &&
    decimalsRead
  // What the stake figures are in: the token's decimals once it is read.
  const decimals = tokenFound ? tokenDecimals : 18
  const gate = useWalletGate({ verb: 'deploy', needsChain: true })
  const [phase, setPhase] = useState<Phase>('idle')
  const [failure, setFailure] = useState('')
  const [failedAt, setFailedAt] = useState<Phase>()
  const [txSubmitted, setTxSubmitted] = useState<string>()
  const [pendingHash, setPendingHash] = useState<Hash>()
  // Sent, but no receipt came back (viem stops waiting after three minutes,
  // or the node failed): it may still be mined, so it is not a failure, and
  // deploying again could make a second list.
  const [stillPending, setStillPending] = useState(false)
  const [metaEvidencePath, setMetaEvidencePath] = useState<string>()
  const factoryAddress =
    targetChainId === undefined
      ? undefined
      : pgtcrFactoryAddresses[targetChainId]
  const defaultTCRAddress =
    targetChainId === undefined ? undefined : defaultTcrAddresses[targetChainId]
  const evidenceDisplayInterfaceURI =
    targetChainId === undefined
      ? undefined
      : defaultEvidenceDisplayUriPermanent[targetChainId]
  const { metaEvidence, submissionDeposit } = useLightTcrView(
    defaultTCRAddress ?? '',
  )
  const chainName =
    targetChainId === undefined
      ? 'this chain'
      : (NETWORKS_INFO[targetChainId as keyof typeof NETWORKS_INFO]?.name ??
        `chain ${targetChainId}`)
  const court = useCourtSummary(
    targetChainId,
    tcrState.arbitratorAddress,
    tcrState.arbitratorExtraData,
  )
  const problems = useMemo(() => deployProblems(tcrState), [tcrState])

  const deployedAddress =
    (txSubmitted && tcrState.transactions[txSubmitted]?.contractAddress) || ''
  const busy = phase === 'uploading' || phase === 'wallet' || phase === 'mining'

  const configError = factoryAddress
    ? evidenceDisplayInterfaceURI
      ? ''
      : `No evidence display is configured for ${chainName}, so lists cannot be deployed there yet.`
    : `No Stake Curate factory is configured for ${chainName}, so lists cannot be deployed there.`

  // The stake is encoded with the token's decimals, so they must be read first.
  const tokenBlocker = !tcrState.tokenAddress
    ? ''
    : loadingToken
      ? 'Reading the stake token'
      : tokenSymbol === 'tokens'
        ? 'No ERC-20 token could be read at the stake token address'
        : !decimalsRead
          ? `Could not read how many decimals ${tokenSymbol} has`
          : (stakeProblemText(
              stakeProblem(tcrState.submissionMinDeposit, tokenDecimals),
              tokenSymbol,
              tokenDecimals,
            ) ?? '')

  // A Stake list can never change its arbitrator: one that can't price a
  // dispute would leave the list unable to take a single entry.
  const arbitratorCheck = useArbitratorCheck(
    targetChainId,
    tcrState.arbitratorAddress,
    tcrState.arbitratorExtraData,
    chainName,
  )
  const arbitratorBlocker = arbitratorCheck.checking
    ? 'Checking the arbitrator'
    : (arbitratorCheck.problem ?? '')

  let blocker = ''
  if (configError) blocker = configError
  else if (phase === 'done') blocker = 'This list is deployed'
  else if (problems.length > 0) blocker = deployBlocker(problems)
  else if (tokenBlocker) blocker = tokenBlocker
  else if (arbitratorBlocker) blocker = arbitratorBlocker
  else if (gate.blocker) blocker = gate.blocker
  // Only the wallet stands in the way: its fix becomes the primary action.
  const walletFix =
    !busy &&
    !configError &&
    problems.length === 0 &&
    !tokenBlocker &&
    !arbitratorBlocker &&
    gate.blocker
      ? gate.fix
      : undefined

  const onDeploy = async () => {
    if (
      !factoryAddress ||
      !evidenceDisplayInterfaceURI ||
      !publicClient ||
      !walletClient ||
      !tokenFound
    ) {
      // Nothing was attempted: no stage failed, the reason is the status line.
      setFailedAt(undefined)
      setFailure(
        configError ||
          tokenBlocker ||
          'Your wallet is not ready. Reconnect and try again.',
      )
      return
    }
    const factory = factoryAddress as Address
    // Which stage a failure belongs to, for the stepper.
    let stage: Phase = 'uploading'
    setFailure('')
    setFailedAt(undefined)
    setPendingHash(undefined)
    setStillPending(false)
    setMetaEvidencePath(undefined)
    try {
      setPhase('uploading')
      const { ipfsMetaEvidencePath } = await getTcrMetaEvidence(
        tcrState,
        evidenceDisplayInterfaceURI,
        uploadFile,
      )
      setMetaEvidencePath(ipfsMetaEvidencePath)

      stage = 'wallet'
      setPhase('wallet')
      const { request } = await simulateContract(wagmiConfig, {
        address: factory,
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: [
          tcrState.arbitratorAddress,
          tcrState.arbitratorExtraData,
          ipfsMetaEvidencePath,
          tcrState.governorAddress,
          tcrState.tokenAddress,
          // The typed minimum is in tokens: encode it in the token's base units
          // (plainDecimal writes out an exponent such as "5e-14" first).
          parseUnits(
            plainDecimal(tcrState.submissionMinDeposit),
            tokenDecimals,
          ),
          [
            Math.round(Number(tcrState.submissionPeriodDuration) * 60 * 60),
            Math.round(Number(tcrState.reinclusionPeriodDuration) * 60 * 60),
            Math.round(Number(tcrState.withdrawingPeriodDuration) * 60 * 60),
            Math.round(Number(tcrState.arbitrationParamsCooldown) * 60 * 60),
          ],
          // Percent to basis points, exactly as typed (12.5% is 1250).
          [
            Math.round(Number(tcrState.sharedStakeMultiplier) * 100),
            Math.round(Number(tcrState.winnerStakeMultiplier) * 100),
            Math.round(Number(tcrState.loserStakeMultiplier) * 100),
            Math.round(Number(tcrState.challengeStakeMultiplier) * 100),
          ],
        ],
        gas: 8000000n,
        account,
      })

      const result = await wrapWithToast(async () => {
        const hash = await walletClient.writeContract(request)
        // Signed: show the hash while the confirmations come in.
        stage = 'mining'
        setPendingHash(hash)
        setPhase('mining')
        return hash
      }, publicClient)

      if (result.status && result.result) onMined(result.result)
      // Sent (the callback above moved the stage on), but no receipt, which
      // a revert would have: the transaction is still pending.
      else if ((stage as Phase) === 'mining' && !result.result)
        setStillPending(true)
      else {
        setFailedAt(stage)
        setPhase('idle')
        setFailure('The transaction did not go through.')
      }
    } catch (err) {
      console.error('Error deploying list:', err)
      const message = parseWagmiError(err)
      errorToast(message)
      setFailedAt(stage)
      setPhase('idle')
      setFailure(message)
    }
  }

  /** The deployment is mined: the list's address, saved with the transaction. */
  const onMined = (receipt: TransactionReceipt) => {
    const txHash = receipt.transactionHash
    setTxSubmitted(txHash)

    let contractAddress: string | undefined
    try {
      const newGTCRLog = receipt.logs
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
        .find((parsed) => parsed && parsed.eventName === 'NewGTCR')

      if (newGTCRLog) contractAddress = pickAddress(newGTCRLog.args)
    } catch (err) {
      console.error('Error parsing deploy logs:', err)
    }

    setTxState({
      txHash,
      networkId: targetChainId,
      status: 'mined',
      contractAddress,
    })
    setTcrState((prevState) => ({
      ...prevState,
      finished: true,
    }))
    setPhase('done')
  }

  /** Waits for the same transaction again; nothing new is sent. */
  const checkAgain = async () => {
    if (!publicClient || !pendingHash) return
    setStillPending(false)
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: pendingHash,
        confirmations: 2,
      })
      if (receipt.status === 'success') onMined(receipt)
      else {
        setFailedAt('mining')
        setPhase('idle')
        setFailure('The transaction did not go through.')
      }
    } catch (err) {
      console.error('Error waiting for the deploy transaction:', err)
      setStillPending(true)
    }
  }

  /* ---------- Stepper state ---------- */

  const order: Phase[] = ['uploading', 'wallet', 'mining', 'done']
  const reached = order.indexOf(phase)
  const stepStatus = (stage: Phase): TxStatus => {
    if (phase === 'idle') {
      // After a failure, show how far the last attempt got.
      if (!failedAt) return 'upcoming'
      const failed = order.indexOf(failedAt)
      const at = order.indexOf(stage)
      return at < failed ? 'done' : at === failed ? 'failed' : 'upcoming'
    }
    const at = order.indexOf(stage)
    if (phase === 'done' || at < reached) return 'done'
    return at === reached ? 'active' : 'upcoming'
  }

  const explorer =
    targetChainId === undefined ? undefined : getExplorerUrl(targetChainId)
  const shownHash = txSubmitted ?? pendingHash
  const listOfListsTitle = metaEvidence?.metadata?.tcrTitle || 'Curated Lists'
  const listOfListsDeposit = formatMaybe(submissionDeposit)

  /* ---------- Review ---------- */

  const extra = readExtraData(tcrState.arbitratorExtraData)
  const fields = tcrState.columns
    .map((column) => column.label)
    .filter(Boolean)
    .join(', ')
  const percent = effectivePercent(tcrState.challengeStakeMultiplier)
  // A multiplier as the deploy call sends it.
  const percentText = (value: unknown) => `${effectivePercent(value) ?? value}%`
  // Base units as the deploy call encodes them (the token's own decimals).
  const stake = parseAmount(tcrState.submissionMinDeposit, decimals)
  const stakeText = groupAmount(formatToken(stake, decimals))
  const challengerText =
    stake && percent !== null
      ? groupAmount(formatToken(shareOf(stake, percent), decimals))
      : null
  const logo = tcrState.tcrLogo ? parseIpfs(tcrState.tcrLogo) : ''
  // Days and hours, as the Light review and the preview read them; the
  // hours typed in the wizard on hover.
  const hours = (value: number | string) => {
    const seconds = hoursToSeconds(value)
    return {
      value:
        seconds === null || seconds === 0
          ? formatHours(value)
          : formatDurationLong(seconds),
      title: formatHours(value),
    }
  }

  const reviewRows: ReviewItem[] = [
    {
      label: 'Name',
      value: tcrState.tcrTitle || 'Not set',
      empty: !tcrState.tcrTitle,
      step: 'Name',
    },
    {
      label: 'Description',
      value: tcrState.tcrDescription || 'Not set',
      empty: !tcrState.tcrDescription,
      step: 'Description',
    },
    {
      label: 'Logo',
      value: (
        <LogoValue>
          <LogoThumb aria-hidden>
            <SafeImage
              src={logo || undefined}
              alt=""
              fallback={<CurateIcon name="registry" size={12} />}
            />
          </LogoThumb>
          {tcrState.tcrLogo ? 'Uploaded' : 'Not uploaded'}
        </LogoValue>
      ),
      title: tcrState.tcrLogo ? 'Uploaded' : 'Not uploaded',
      empty: !tcrState.tcrLogo,
      step: 'Logo',
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
      value: fields || 'None named',
      empty: !fields,
      step: 'Fields',
    },
    {
      label: 'Stake token',
      value: tcrState.tokenAddress
        ? `${tokenSymbol} · ${truncateMiddle(tcrState.tokenAddress)}`
        : 'Not set',
      title: tcrState.tokenAddress,
      empty: !tcrState.tokenAddress,
      step: 'Token',
    },
    {
      label: 'Minimum stake',
      value:
        stakeText === null
          ? 'Not a valid amount'
          : `${stakeText} ${tokenSymbol}`,
      empty: stakeText === null,
      step: 'Stake',
    },
    {
      label: 'Challenger stake',
      value:
        percent === null
          ? 'Not set'
          : `${percent}%${challengerText ? ` · ${challengerText} ${tokenSymbol} at the minimum` : ' of the entry’s stake'}`,
      empty: percent === null,
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Submission period',
      ...hours(tcrState.submissionPeriodDuration),
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Reinclusion period',
      ...hours(tcrState.reinclusionPeriodDuration),
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Withdrawing period',
      ...hours(tcrState.withdrawingPeriodDuration),
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Parameters cooldown',
      ...hours(tcrState.arbitrationParamsCooldown),
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Court',
      value: court.text
        ? court.text
        : extra
          ? `Court ${extra.courtID} · ${extra.numberOfJurors} juror${extra.numberOfJurors === 1 ? '' : 's'}`
          : truncateMiddle(tcrState.arbitratorExtraData || '', 10, 6),
      mono: !court.text && !extra,
      title: tcrState.arbitratorExtraData,
      step: 'Stake',
    },
    {
      label: 'Arbitrator',
      value: truncateMiddle(tcrState.arbitratorAddress),
      title: tcrState.arbitratorAddress,
      mono: true,
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Governor',
      value: truncateMiddle(tcrState.governorAddress),
      title: tcrState.governorAddress,
      mono: true,
      step: 'Stake',
      advanced: true,
    },
    {
      label: 'Appeal multipliers',
      value: `shared ${percentText(tcrState.sharedStakeMultiplier)} · winner ${percentText(tcrState.winnerStakeMultiplier)} · loser ${percentText(tcrState.loserStakeMultiplier)}`,
      step: 'Stake',
      advanced: true,
    },
  ]

  return (
    <StepBody>
      <StepHeader
        heading={phase === 'done' ? 'List deployed' : 'Review and deploy'}
        lede={
          phase === 'done'
            ? 'The list is live; it is also saved in this browser under your deployments.'
            : `One transaction on ${chainName}, gas only: submitters stake ${tokenSymbol} and pay arbitration in ${nativeCurrency} later. The governor can change most parameters; the stake token is fixed.`
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
                data-mono={row.mono || undefined}
                title={
                  row.title ??
                  (typeof row.value === 'string' ? row.value : undefined)
                }
              >
                {row.value}
              </dd>
              {row.warning && <dd data-warning="true">{row.warning}</dd>}
              {onEditStep && (
                <EditButton
                  type="button"
                  aria-label={`Edit ${row.label.toLowerCase()}`}
                  onClick={() =>
                    onEditStep(row.step, { advanced: row.advanced })
                  }
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
          {phase === 'idle' && !failedAt ? 'What deploying does' : 'Deployment'}
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
                ? 'The upload failed, so nothing was deployed.'
                : 'One small file: the rules, the fields and the policy link.'
            }
          >
            {metaEvidencePath && (
              <TxData>
                <TxLink
                  href={parseIpfs(metaEvidencePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={metaEvidencePath}
                >
                  <span>Rules</span>
                  {truncateMiddle(
                    metaEvidencePath.replace(/^\/?ipfs\//, '').split('/')[0],
                    6,
                    4,
                  )}
                </TxLink>
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
                ? 'The transaction was not sent, so nothing was deployed.'
                : 'Confirm in your wallet. The factory deploys the list; it takes no deposit.'
            }
          />
          <TxStep
            index={2}
            number={3}
            status={stepStatus('mining')}
            title="Wait for two confirmations"
            note={
              stepStatus('mining') === 'failed'
                ? 'The transaction did not go through; nothing was deployed.'
                : stillPending
                  ? 'Not mined yet, but it may still go through: follow it on the explorer before deploying again.'
                  : 'Keep this page open until the transaction is mined.'
            }
          >
            {shownHash && (
              <TxData>
                {explorer ? (
                  <TxLink
                    href={`${explorer}/tx/${shownHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={shownHash}
                  >
                    <span>Transaction</span>
                    {truncateMiddle(shownHash, 8, 6)}
                    <CurateIcon name="external" size={12} />
                  </TxLink>
                ) : (
                  <TxPill title={shownHash}>
                    <span>Transaction</span>
                    {truncateMiddle(shownHash, 8, 6)}
                  </TxPill>
                )}
              </TxData>
            )}
          </TxStep>
          <TxStep
            index={3}
            number={4}
            status={phase === 'done' ? 'done' : 'upcoming'}
            title="The list goes live"
          >
            {phase === 'done' && deployedAddress && (
              <TxData>
                {explorer ? (
                  <TxLink
                    href={`${explorer}/address/${deployedAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={deployedAddress}
                  >
                    <span>Address</span>
                    {truncateMiddle(deployedAddress, 8, 6)}
                    <CurateIcon name="external" size={12} />
                  </TxLink>
                ) : (
                  <TxPill title={deployedAddress}>
                    <span>Address</span>
                    {truncateMiddle(deployedAddress, 8, 6)}
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

      {phase !== 'done' ? (
        <ActionArea>
          <Row $gap={10} $wrap>
            {stillPending ? (
              <Button type="button" $variant="primary" onClick={checkAgain}>
                Check again
              </Button>
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
          <div role="status">
            {busy ? (
              <Row $gap={8}>
                <StatusDot $tone="window" aria-hidden />
                <Small $muted>
                  {phase === 'uploading'
                    ? 'Uploading the list metadata to IPFS'
                    : phase === 'wallet'
                      ? 'Waiting for your wallet: confirm the deployment'
                      : stillPending
                        ? 'The transaction is still pending'
                        : 'Deploying: waiting for the transaction; keep this page open'}
                </Small>
              </Row>
            ) : failedAt || failure ? (
              <Row $gap={8} $align="flex-start">
                <StatusDot $tone="off" aria-hidden style={{ marginTop: 6 }} />
                <Small $muted>
                  <Small>Deployment failed</Small>
                  {failure ? ` · ${failure}` : ''}
                </Small>
              </Row>
            ) : blocker && !walletFix ? (
              <Row $gap={8}>
                <StatusDot $tone="neutral" aria-hidden />
                <Small $muted>{blocker}</Small>
              </Row>
            ) : null}
          </div>
        </ActionArea>
      ) : (
        <ActionArea>
          <Row $gap={8} role="status" $wrap>
            <StatusDot $tone="registered" aria-hidden />
            <Small>Deployed</Small>
            {deployedAddress && (
              <Data $mono $muted $weight={400} title={deployedAddress}>
                {truncateMiddle(deployedAddress, 10, 8)}
              </Data>
            )}
          </Row>
          <Row $gap={10} $wrap>
            {targetChainId !== undefined && deployedAddress && (
              <ButtonLink
                to={`/tcr/${targetChainId}/${deployedAddress}`}
                $variant="primary"
              >
                Open {tcrState.tcrTitle}
              </ButtonLink>
            )}
            {targetChainId !== undefined && defaultTCRAddress && (
              // Its submit page, with the new list's address as the first
              // value (a list of lists' column), as the Light deploy's form.
              <ButtonLink
                to={
                  deployedAddress
                    ? `/tcr/${targetChainId}/${defaultTCRAddress}/submit?address=${deployedAddress}`
                    : `/tcr/${targetChainId}/${defaultTCRAddress}`
                }
                $variant="secondary"
              >
                Submit it to {listOfListsTitle}
              </ButtonLink>
            )}
          </Row>
          <Small $muted>
            Bookmark the address. Submitting the list to the list of lists helps
            other people find it.
          </Small>
        </ActionArea>
      )}
    </StepBody>
  )
}

export default Deploy
