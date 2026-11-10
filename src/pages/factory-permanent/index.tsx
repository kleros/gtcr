import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { Link, useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { ethers } from 'ethers'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import _GTCRFactory from 'assets/abis/PermanentGTCRFactory.json'
import { version } from '../../../package.json'
import { parseIpfs } from 'utils/ipfs-parse'
import { NETWORKS, NETWORKS_INFO } from 'config/networks'
import {
  defaultArbitrator as defaultArbitratorAddresses,
  defaultArbitratorExtraData as defaultArbitratorExtraDataObj,
  defaultGovernor as defaultGovernorAddresses,
  pgtcrFactoryAddresses,
} from 'config/tcr-addresses'
import { CurateIcon } from 'components/curate/icons'
import { Explainer } from 'components/curate/explainer'
import {
  ChainChip,
  Chip,
  Data,
  EmptyState,
  Label,
  Page,
  Row,
  Section,
  SegmentedControl,
  SkeletonBlock,
  Small,
  Stack,
  Statement,
  Surface,
  truncateMiddle,
} from 'components/curate/primitives'
import {
  type FactoryWizardStep,
  FactoryAside,
  FactorySplit,
  FactoryStepPanel,
  FactoryStepTimeline,
  FactoryWizardGrid,
  factoryDocumentTitle,
  useFactoryWizard,
} from 'components/curate/v2-factory-shell'
import {
  StakeDeploymentLink,
  StakeDeploymentLogo,
  StakeDeploymentRows,
  StakeHead,
  StakeHeadCopy,
  StakeLede,
  StakeLift,
  StakeOpenHint,
  StakeSectionHead,
} from 'components/curate/stake-factory-shell'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'
import { StakePreview } from './preview'
import { SafeImage } from './controls'
import { DEFAULT_COLUMN, WIZARD_DEFAULTS, defaultStakeToken } from './defaults'
import {
  type FactorySection,
  itemColumnsProblem,
  itemSchema,
  tcrSchemaFor,
} from './schemas'
import { stakeProblem } from './format'

/*
 * Stake Curate factory (route /factory-permanent/:chainId): the page's
 * statement and one explainer, a stepper whose progress slides through the
 * sub-steps, the current step in one panel with its action bar (Next submits
 * the step's form, so its schema runs) beside a live preview of what a
 * submitter and a challenger lock, then the lists deployed from this
 * browser. The wizard itself is shared with the Light factory
 * (useFactoryWizard): every step up to the furthest one reached stays open
 * from the stepper and the tabs until an earlier step stops validating, and
 * an Edit from the review offers "Back to review" once the step validates.
 * The draft lives in localStorage per chain and app version, so a
 * half-finished list (the step it was on and how far it got) survives a
 * reload.
 */

interface TransactionInfo {
  txHash: string
  networkId?: number
  isConnectedTCR?: boolean
  status?: string
  contractAddress?: string
  [key: string]: unknown
}

export interface TcrState {
  tcrTitle: string
  tcrDescription: string
  /** As typed (text keeps every decimal), or the slider's number. */
  submissionMinDeposit: number | string
  arbitratorAddress: string
  governorAddress: string
  tokenAddress: string
  submissionPeriodDuration: number
  reinclusionPeriodDuration: number
  withdrawingPeriodDuration: number
  arbitrationParamsCooldown: number
  itemName: string
  itemNamePlural: string
  requireRemovalEvidence: boolean
  tcrPrimaryDocument: string
  tcrLogo: string
  arbitratorExtraData?: string
  challengeStakeMultiplier: number
  sharedStakeMultiplier: number
  winnerStakeMultiplier: number
  loserStakeMultiplier: number
  columns: Column[]
  currStep: number
  /** The sub-step the wizard was on, restored after a reload. */
  visualStep?: number
  /** The furthest sub-step reached; every step up to it can be reopened. */
  maxVisualStep?: number
  chainId?: number
  transactions: Record<string, TransactionInfo>
  finished?: boolean
}

export interface CachedFactory {
  tcrState: TcrState
  setTcrState: React.Dispatch<React.SetStateAction<TcrState>>
  resetTcrState: () => void
  nextStep: () => void
  previousStep: () => void
  resetStepper: () => void
  STEP_COUNT: number
  setTxState: (tx: TransactionInfo) => void
  defaultArbLabel?: string
  defaultArbDataLabel?: string
  defaultGovernorLabel?: string
  defaultStakeTokenLabel?: string
}

export interface StepProps extends CachedFactory {
  formId?: string
  postSubmit: () => void
}

const STEP_COUNT = 3

export const formIds = ['tcrParamsForm', 'itemParamsForm', 'deployTCRForm']

/** The stepper's groups; the sub-items only move its progress bar. */
const STAKE_FACTORY_STEPS = [
  {
    title: 'List',
    description: 'Name, logo and policy',
    subitems: ['Name', 'Description', 'Logo', 'Policy'],
  },
  {
    title: 'Stake',
    description: 'Token, stake and court',
    subitems: ['Token', 'Stake'],
  },
  {
    title: 'Item',
    description: 'Fields and item name',
    subitems: ['Fields', 'Item name'],
  },
  {
    title: 'Deploy',
    description: 'One signature',
  },
]

type StakeVisualStep = FactoryWizardStep & {
  /** The form step it renders: 1 list, 2 item, 3 deploy (stored as currStep). */
  kind: 'tcr' | 'item' | 'deploy'
  section?: FactorySection
}

const VISUAL_STEPS: StakeVisualStep[] = [
  {
    title: 'Name',
    componentStep: 1,
    groupStep: 1,
    kind: 'tcr',
    section: 'title',
  },
  {
    title: 'Description',
    componentStep: 1,
    groupStep: 1,
    kind: 'tcr',
    section: 'description',
  },
  {
    title: 'Logo',
    componentStep: 1,
    groupStep: 1,
    kind: 'tcr',
    section: 'logo',
  },
  {
    title: 'Policy',
    componentStep: 1,
    groupStep: 1,
    kind: 'tcr',
    section: 'policy',
  },
  {
    title: 'Token',
    componentStep: 1,
    groupStep: 2,
    kind: 'tcr',
    section: 'token',
  },
  {
    title: 'Stake',
    componentStep: 1,
    groupStep: 2,
    kind: 'tcr',
    section: 'stake',
  },
  { title: 'Fields', componentStep: 2, groupStep: 3, kind: 'item' },
  {
    title: 'Item name',
    componentStep: 1,
    groupStep: 3,
    kind: 'tcr',
    section: 'custom',
  },
  { title: 'Deploy', componentStep: 3, groupStep: 4, kind: 'deploy' },
]

/**
 * Whether a step's stored values still pass its own Next. `stakeDecimals` is
 * the stake token's decimals once read: the Stake step also needs a minimum
 * the deploy call can encode for it.
 */
const stepValid = (
  step: StakeVisualStep,
  state: TcrState,
  stakeDecimals?: number,
): boolean => {
  if (step.kind === 'tcr')
    return (
      tcrSchemaFor(step.section).isValidSync(state) &&
      (step.section !== 'stake' ||
        stakeDecimals === undefined ||
        stakeProblem(state.submissionMinDeposit, stakeDecimals) === null)
    )
  if (step.kind === 'item')
    return (
      itemSchema.isValidSync(state) &&
      itemColumnsProblem(state.columns) === null
    )
  return true
}

const SUPPORTED_CHAINS: number[] = [
  NETWORKS.gnosis,
  NETWORKS.ethereum,
  NETWORKS.sepolia,
].filter((chainId) => !!pgtcrFactoryAddresses[chainId])

const chainNameOf = (chainId: number): string =>
  NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]?.name ??
  `chain ${chainId}`

/* ---------- Wizard state ---------- */

const useCachedFactory = (
  appVersion: string,
  networkId: number | undefined,
): CachedFactory | null => {
  const { account } = useWeb3Context()
  const { address: defaultArbitrator, label: defaultArbLabel } =
    (networkId !== undefined && defaultArbitratorAddresses[networkId]) || {}
  const { address: defaultGovernor, label: defaultGovernorLabel } =
    (networkId !== undefined && defaultGovernorAddresses[networkId]) || {}
  const { data: defaultArbitratorExtraData, label: defaultArbDataLabel } =
    (networkId !== undefined && defaultArbitratorExtraDataObj[networkId]) || {}
  const { address: defaultToken, label: defaultStakeTokenLabel } =
    (networkId !== undefined && defaultStakeToken[networkId]) || {}

  const key = `pgtcrState@${networkId}@${appVersion}`
  const initialWizardState = {
    tcrTitle: '',
    tcrDescription: '',
    submissionMinDeposit: WIZARD_DEFAULTS.submissionMinDeposit,
    arbitratorAddress: defaultArbitrator || '',
    governorAddress: account || defaultGovernor || '',
    tokenAddress: defaultToken || '',
    submissionPeriodDuration: WIZARD_DEFAULTS.submissionPeriodDuration,
    reinclusionPeriodDuration: WIZARD_DEFAULTS.reinclusionPeriodDuration,
    withdrawingPeriodDuration: WIZARD_DEFAULTS.withdrawingPeriodDuration,
    arbitrationParamsCooldown: WIZARD_DEFAULTS.arbitrationParamsCooldown,
    itemName: WIZARD_DEFAULTS.itemName,
    itemNamePlural: WIZARD_DEFAULTS.itemNamePlural,
    requireRemovalEvidence: true,
    tcrPrimaryDocument: '',
    tcrLogo: '',
    arbitratorExtraData: defaultArbitratorExtraData,
    challengeStakeMultiplier: WIZARD_DEFAULTS.challengeStakeMultiplier,
    sharedStakeMultiplier: WIZARD_DEFAULTS.sharedStakeMultiplier,
    winnerStakeMultiplier: WIZARD_DEFAULTS.winnerStakeMultiplier,
    loserStakeMultiplier: WIZARD_DEFAULTS.loserStakeMultiplier,
    columns: [{ ...DEFAULT_COLUMN }],
    currStep: 1,
    chainId: networkId,
  }
  const initialState: TcrState = {
    ...initialWizardState,
    transactions: {},
  }

  const newInitialState: TcrState = JSON.parse(JSON.stringify(initialState)) // Deep copy.
  const cached = window.localStorage.getItem(key)
  let resolvedState: TcrState = newInitialState
  if (cached) {
    const parsed = JSON.parse(cached) as TcrState
    if (parsed.arbitratorAddress && parsed.chainId === networkId)
      resolvedState = parsed
  }

  // We check for the finished flag to reset the form
  // if the user finished his previous deployment.
  // We only keep the deployment transactions.
  if (resolvedState.finished)
    resolvedState = {
      ...newInitialState,
      transactions: resolvedState.transactions,
    }

  const [tcrState, setTcrState] = useState<TcrState>(resolvedState)
  const [debouncedTcrState] = useDebounce(tcrState, 1000)
  const [prevNetworkId, setPrevNetworkId] = useState(networkId)

  // Synchronous state reset when chain changes via URL.
  if (networkId && networkId !== prevNetworkId) {
    setPrevNetworkId(networkId)
    setTcrState((prev) => ({
      ...JSON.parse(JSON.stringify(initialWizardState)),
      transactions: prev.transactions,
    }))
  }

  useEffect(() => {
    if (
      !networkId ||
      !debouncedTcrState ||
      !debouncedTcrState.arbitratorAddress
    )
      return
    window.localStorage.setItem(key, JSON.stringify({ ...debouncedTcrState }))
  }, [debouncedTcrState, key, networkId])

  if (!networkId || !tcrState.arbitratorAddress) return null

  const nextStep = () =>
    setTcrState((prevState) => ({
      ...prevState,
      currStep:
        prevState.currStep === STEP_COUNT
          ? prevState.currStep
          : prevState.currStep + 1,
    }))
  const previousStep = () =>
    setTcrState((prevState) => ({
      ...prevState,
      currStep:
        prevState.currStep === 1 ? prevState.currStep : prevState.currStep - 1,
    }))
  const resetStepper = () =>
    setTcrState((prevState) => ({ ...prevState, currStep: 1 }))
  const resetTcrState = () =>
    setTcrState((prevState) => ({
      ...JSON.parse(JSON.stringify(initialWizardState)),
      transactions: prevState.transactions,
    }))
  const setTxState = (tx: TransactionInfo) =>
    setTcrState((prevState) => ({
      ...prevState,
      transactions: {
        ...prevState.transactions,
        [tx.txHash]: tx,
      },
    }))

  return {
    tcrState,
    setTcrState,
    resetTcrState,
    nextStep,
    previousStep,
    resetStepper,
    STEP_COUNT,
    setTxState,
    defaultArbLabel,
    defaultArbDataLabel,
    defaultGovernorLabel,
    defaultStakeTokenLabel,
  }
}

/* ---------- Layout ---------- */

const ChainLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
`

const ChainLink = styled(Link)`
  display: inline-flex;
  border-radius: var(--radius-pill);
  text-decoration: none;
`

/* ---------- Previous deployments ---------- */

/** One list deployed from this browser: logo, title and address, linking to the list. */
const DeploymentRow = ({
  address,
  chainId,
  index,
}: {
  address: string
  chainId: number
  index: number
}) => {
  const { data: metaEvidence, isLoading } = useTcrMetaEvidence(address, chainId)
  const metadata = metaEvidence?.metadata
  const title = metadata?.tcrTitle ?? metaEvidence?.title
  const logo = metadata?.logoURI ? parseIpfs(metadata.logoURI) : undefined
  return (
    <StakeDeploymentLink
      to={`/tcr/${chainId}/${address}`}
      style={{ ['--i' as string]: Math.min(index, 8) }}
    >
      <StakeDeploymentLogo aria-hidden>
        <SafeImage
          src={logo}
          alt=""
          fallback={<CurateIcon name="registry" size={16} />}
        />
      </StakeDeploymentLogo>
      <span style={{ minWidth: 0 }}>
        {isLoading ? (
          <SkeletonBlock $height="18px" $width="40%" />
        ) : (
          <strong>{title || 'Untitled list'}</strong>
        )}
        <Data $mono $muted $weight={400} title={address}>
          {truncateMiddle(address, 10, 8)}
        </Data>
      </span>
      <StakeOpenHint>
        Open
        <CurateIcon
          name="chevron-down"
          size={14}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden
        />
      </StakeOpenHint>
    </StakeDeploymentLink>
  )
}

/* ---------- Page ---------- */
const FactoryPermanentPage = () => {
  const urlChainId = useUrlChainId()
  const navigate = useNavigate()
  const nativeCurrency = useNativeCurrency()
  const factoryChainId = urlChainId ?? undefined
  const supported =
    factoryChainId !== undefined && !!pgtcrFactoryAddresses[factoryChainId]
  const cachedFactory = useCachedFactory(
    version,
    supported ? factoryChainId : undefined,
  )
  const provider = useEthersProvider({ chainId: factoryChainId })
  const [previousDeployments, setPreviousDeployments] = useState<string[]>([])
  const [deploymentsFailed, setDeploymentsFailed] = useState(false)
  const tcrState = cachedFactory?.tcrState
  // Set by an Edit in the review that points at an advanced field.
  const [openAdvanced, setOpenAdvanced] = useState(false)
  const closeAdvanced = useCallback(() => setOpenAdvanced(false), [])
  // The stake token's decimals, once read, for the Stake step's validity.
  const stakeToken = useTokenSymbol(tcrState?.tokenAddress || undefined)
  const stakeDecimals =
    !stakeToken.loading &&
    stakeToken.decimalsRead &&
    stakeToken.symbol !== 'tokens'
      ? stakeToken.decimals
      : undefined
  const isStepValid = useCallback(
    (step: FactoryWizardStep, index: number) =>
      !tcrState ||
      stepValid(VISUAL_STEPS[index] ?? step, tcrState, stakeDecimals),
    [tcrState, stakeDecimals],
  )
  const wizard = useFactoryWizard({
    steps: VISUAL_STEPS,
    draft: tcrState,
    setDraft: cachedFactory?.setTcrState,
    resetDraft: cachedFactory?.resetTcrState,
    chainId: factoryChainId,
    isStepValid,
    onNavigate: closeAdvanced,
  })

  const transactions = tcrState?.transactions
  const currentVisualStep = VISUAL_STEPS[wizard.index]

  useDocumentHead(
    factoryDocumentTitle('Stake'),
    'Create a Stake Curate list: name it, set the stake token and deposit, choose the court and the fields, then deploy it with one transaction.',
  )

  const factoryInterface = useMemo(
    () => new ethers.utils.Interface(_GTCRFactory),
    [],
  )

  // Lists deployed from this browser on this chain: the address stored with
  // the transaction, or read from its receipt's NewGTCR log.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!transactions || factoryChainId === undefined) return
      const own = Object.values(transactions).filter(
        (tx) => tx.networkId === factoryChainId,
      )
      if (own.length === 0) return
      try {
        const topic = factoryInterface.getEventTopic('NewGTCR')
        const addresses = await Promise.all(
          own.map(async (tx) => {
            if (tx.contractAddress) return tx.contractAddress
            if (!provider) return ''
            const receipt = await provider.waitForTransaction(
              tx.txHash,
              1,
              30_000,
            )
            const log = receipt.logs.find((entry) => entry.topics[0] === topic)
            return log
              ? String(factoryInterface.parseLog(log).args._address)
              : ''
          }),
        )
        if (!cancelled) {
          setPreviousDeployments(addresses.filter(Boolean))
          setDeploymentsFailed(false)
        }
      } catch (err) {
        console.error('Could not read previous deployments:', err)
        if (!cancelled) setDeploymentsFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [factoryChainId, factoryInterface, provider, transactions])

  const header = (
    <>
      <StakeHead>
        <StakeHeadCopy style={{ ['--i' as string]: 0 }}>
          <Row $gap={10} $wrap>
            <Label $tone="faint">Launch a list</Label>
            {factoryChainId !== undefined && (
              <ChainChip chainId={factoryChainId} size="sm" />
            )}
          </Row>
          <Statement>Create a Stake list</Statement>
          <StakeLede>
            Entries keep a token stake locked while listed and can be challenged
            at any time; the draft is saved in this browser as you type.
          </StakeLede>
        </StakeHeadCopy>
        <div style={{ ['--i' as string]: 1 }}>
          <SegmentedControl
            ariaLabel="List type"
            value="permanent"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'permanent', label: 'Stake' },
            ]}
            onChange={(next) => {
              if (next === 'light') navigate(`/factory/${factoryChainId ?? ''}`)
            }}
          />
        </div>
      </StakeHead>
      <Section $gap="sm">
        <StakeLift style={{ ['--i' as string]: 2 }}>
          <Explainer
            id="factory-permanent"
            eyebrow="Before you start"
            heading="What a Stake list needs"
            steps={[
              {
                title: 'A description and a policy',
                body: 'A name, a one-line description, a logo and the listing policy: the PDF jurors and challengers use to judge every entry.',
              },
              {
                title: 'A stake token, a stake and a court',
                body: 'The ERC-20 submitters lock while an entry is listed, the minimum stake, the share a challenger matches and the Kleros court that rules.',
              },
              {
                title: 'One transaction',
                body: 'The factory deploys the list in one transaction that costs gas only. Submitters stake and pay arbitration later.',
              },
            ]}
          />
        </StakeLift>
      </Section>
    </>
  )

  if (urlChainId === null)
    return (
      <Page>
        <Section aria-busy>
          <Stack $gap={16}>
            <SkeletonBlock $height="20px" $width="120px" />
            <SkeletonBlock $height="44px" $width="60%" />
            <SkeletonBlock $height="320px" />
          </Stack>
        </Section>
      </Page>
    )

  if (!supported || !cachedFactory || !tcrState || !currentVisualStep)
    return (
      <Page>
        {header}
        <Section $gap="lg">
          <Surface $padding="none">
            <EmptyState
              icon="factory"
              title="Stake Curate lists can be created on Gnosis, Ethereum and Sepolia"
              action={
                <ChainLinks>
                  {SUPPORTED_CHAINS.map((chainId) => (
                    <ChainLink
                      key={chainId}
                      to={`/factory-permanent/${chainId}`}
                      aria-label={`Create a Stake list on ${chainNameOf(chainId)}`}
                    >
                      <ChainChip chainId={chainId} />
                    </ChainLink>
                  ))}
                </ChainLinks>
              }
            >
              {supported
                ? 'The factory for this chain could not be set up.'
                : `There is no Stake Curate factory on chain ${urlChainId}. Pick one of the supported chains.`}
            </EmptyState>
          </Surface>
        </Section>
      </Page>
    )

  const chainId = tcrState.chainId ?? urlChainId
  const chainName = chainNameOf(chainId)
  const currentFormId = formIds[currentVisualStep.componentStep - 1]
  const stepKey = `${chainId}-${wizard.index}-${wizard.resets}`

  const renderVisualStep = () => {
    switch (currentVisualStep.kind) {
      case 'tcr':
        return (
          <TCRParams
            key={stepKey}
            formId={currentFormId}
            factorySection={currentVisualStep.section}
            startAdvanced={openAdvanced}
            postSubmit={wizard.advance}
            {...cachedFactory}
          />
        )
      case 'item':
        return (
          <ItemParams
            key={stepKey}
            formId={currentFormId}
            postSubmit={wizard.advance}
            {...cachedFactory}
          />
        )
      case 'deploy':
        return (
          <Deploy
            key={stepKey}
            formId={currentFormId}
            postSubmit={wizard.advance}
            onEditStep={(title, options) => {
              wizard.editStep(title)
              setOpenAdvanced(!!options?.advanced)
            }}
            {...cachedFactory}
          />
        )
      default:
        return null
    }
  }

  return (
    <Page>
      {header}

      <Section $gap="lg">
        <FactoryWizardGrid>
          <StakeLift style={{ ['--i' as string]: 3 }}>
            <FactoryStepTimeline groups={STAKE_FACTORY_STEPS} wizard={wizard} />
          </StakeLift>
          <FactorySplit>
            <FactoryStepPanel
              wizard={wizard}
              groups={STAKE_FACTORY_STEPS}
              formId={currentFormId}
              style={{ ['--i' as string]: 4 }}
            >
              {renderVisualStep()}
            </FactoryStepPanel>
            <FactoryAside aria-label="Preview">
              <StakeLift style={{ ['--i' as string]: 5 }}>
                <StakePreview
                  tcrState={tcrState}
                  chainId={chainId}
                  currency={nativeCurrency}
                />
              </StakeLift>
            </FactoryAside>
          </FactorySplit>
        </FactoryWizardGrid>
      </Section>

      {(previousDeployments.length > 0 || deploymentsFailed) && (
        <section aria-label="Previous deployments">
          <StakeSectionHead>
            <h2>
              Your deployments
              {previousDeployments.length > 0 && (
                <Chip>{previousDeployments.length}</Chip>
              )}
            </h2>
            <Small $faint>
              Lists deployed from this browser on {chainName}.
            </Small>
          </StakeSectionHead>
          {deploymentsFailed ? (
            <Surface $padding="none">
              <EmptyState
                icon="list"
                title="Previous deployments could not be read"
              >
                The receipts of your earlier deployments on {chainName} did not
                load. They are still stored in this browser; try again later.
              </EmptyState>
            </Surface>
          ) : (
            <StakeDeploymentRows>
              {previousDeployments.map((address, index) => (
                <DeploymentRow
                  key={address}
                  address={address}
                  chainId={chainId}
                  index={index}
                />
              ))}
            </StakeDeploymentRows>
          )}
        </section>
      )}
    </Page>
  )
}

export default FactoryPermanentPage
