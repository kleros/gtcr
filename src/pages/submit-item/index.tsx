import React, {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { BigNumber } from 'ethers'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ErrorPage from 'pages/error-page'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import useTcrNetwork from 'hooks/use-tcr-network'
import useUrlChainId from 'hooks/use-url-chain-id'
import useArbitrationCost from 'hooks/arbitration-cost'
import useFactory from 'hooks/factory'
import useNativeCurrency from 'hooks/native-currency'
import useNativeBalance from 'hooks/use-native-balance'
import useTokenSymbol from 'hooks/token-symbol'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { TCRViewContext, TCRViewProvider } from 'contexts/tcr-view-context'
import {
  LightTCRViewContext,
  LightTCRViewProvider,
} from 'contexts/light-tcr-view-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { PERMANENT_REGISTRY_QUERY } from 'utils/graphql'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatDuration, formatDurationLong } from 'utils/time'
import {
  SubmitPage,
  SubmitPageSkeleton,
  type ConfirmGate,
  type SubmitTerms,
} from './submit-page'
import { amountText, formatAmount, type Amount } from './amounts'
import { useWalletGate } from './use-wallet-gate'
import { useDepositSubmit, usePermanentSubmit } from './use-submit-actions'

/*
 * /tcr/:chainId/:tcrAddress/submit. The registry kind decides the data
 * source and the contract call (classic, light or Stake Curate); the page
 * itself is shared. The checks, providers and error states are the ones the
 * previous page had.
 */

const NO_DISABLED_FIELDS: boolean[] = []

/**
 * Values a shared ?action= link carried (the registry forwards them here as
 * the query string), in column order, as the previous submit dialog read
 * them. The theme preview parameter is not a value.
 */
const useLinkValues = (): unknown[] => {
  const { search } = useLocation()
  return useMemo(() => {
    const values: string[] = []
    new URLSearchParams(search).forEach((value, key) => {
      if (key !== 'cv-theme') values.push(value)
    })
    return values
  }, [search])
}

const useRegistryPath = () => {
  const { chainId, tcrAddress } = useParams<{
    chainId: string
    tcrAddress: string
  }>()
  return `/tcr/${chainId}/${tcrAddress}`
}

/** "Not enough xDAI for the deposit (you have 12.4 xDAI)" or nothing. */
const balanceBlocker = (
  balance: bigint | undefined,
  required: bigint,
  currency: string,
  purpose: string,
  decimals = 18,
): string =>
  balance !== undefined && balance < required
    ? `Not enough ${currency} for the ${purpose} (you have ${formatAmount(
        balance,
        decimals,
      )} ${currency})`
    : ''

/* ---------- Classic and light Curate: one native deposit ---------- */

const DepositSubmitPage = ({
  kind,
  tcrAddress,
  metaEvidence,
  submissionDeposit,
  submissionBaseDeposit,
  submissionChallengeBaseDeposit,
  arbitrationCost,
  challengePeriodDuration,
}: {
  kind: 'light' | 'classic'
  tcrAddress: string
  metaEvidence?: MetaEvidence
  submissionDeposit?: BigNumber
  submissionBaseDeposit?: BigNumber
  /** What a challenger stakes besides the arbitration cost; the winner gets it. */
  submissionChallengeBaseDeposit?: BigNumber
  arbitrationCost?: BigNumber
  challengePeriodDuration?: BigNumber
}) => {
  const navigate = useNavigate()
  const registryPath = useRegistryPath()
  const linkValues = useLinkValues()
  const chainId = useUrlChainId()
  const currency = useNativeCurrency()
  const { balance } = useNativeBalance()
  const factoryChecks = useFactory()
  const wallet = useWalletGate()
  const onDone = useCallback(
    () => navigate(registryPath),
    [navigate, registryPath],
  )
  const { submit, phase, submitting } = useDepositSubmit({
    kind,
    tcrAddress,
    submissionDeposit,
    onDone,
  })

  const metadata = metaEvidence?.metadata
  const itemName = metadata?.itemName || 'item'
  const registryTitle =
    metadata?.tcrTitle ?? metadata?.title ?? metaEvidence?.title
  const columns = metadata?.columns
  const policyURI = metaEvidence?.fileURI
  const ready = !!metaEvidence && !!submissionDeposit && !!columns

  const native = (value?: BigNumber): Amount | undefined =>
    value
      ? { value: BigInt(value.toString()), decimals: 18, symbol: currency }
      : undefined
  const totalAmount = native(submissionDeposit)
  const baseAmount = native(submissionBaseDeposit)
  const costAmount = native(arbitrationCost)
  const challengeBaseAmount = native(submissionChallengeBaseDeposit)
  const total = amountText(totalAmount)
  const base = amountText(baseAmount)
  const cost = amountText(costAmount)
  const seconds = challengePeriodDuration?.toNumber()
  // Winning a challenge returns the deposit plus the challenger's base
  // deposit (the round's fee rewards, less the one arbitration cost paid).
  const challengerBase =
    challengeBaseAmount && challengeBaseAmount.value > 0n
      ? amountText(challengeBaseAmount)
      : ''

  const terms: SubmitTerms = {
    headline: totalAmount,
    parts: [
      {
        key: 'base',
        label: 'Base deposit',
        amount: baseAmount,
        tone: 'primary',
      },
      {
        key: 'cost',
        label: 'Arbitration cost',
        amount: costAmount,
        tone: 'faint',
      },
    ],
    amountText: total,
    period:
      seconds !== undefined
        ? {
            seconds,
            label: 'Challenge period',
            endLabel: 'Ends',
            noneText:
              'No challenge period: the request can be executed right away.',
          }
        : undefined,
    outcomes: [
      {
        key: 'clear',
        tone: 'registered',
        title: 'No challenge',
        status: 'Registered',
        figure: `${total} back`,
        note: 'when the request is executed',
      },
      {
        key: 'challenged',
        tone: 'contested',
        title: 'If challenged',
        status: 'Challenged',
        note: 'Kleros jurors check it against the policy',
        children: [
          {
            key: 'win',
            tone: 'registered',
            title: 'Jurors side with you',
            status: 'Registered',
            figure: challengerBase
              ? [`${total} back`, `+${challengerBase}`]
              : `${total} back`,
            note: challengerBase
              ? "plus the challenger's base deposit"
              : undefined,
          },
          {
            key: 'lose',
            tone: 'off',
            title: 'Jurors side with the challenger',
            status: 'Rejected',
            figure: `−${total}`,
            note: `${base} to the challenger, ${cost} for arbitration`,
          },
        ],
      },
    ],
    status: {
      label: 'Submitted',
      detail:
        seconds !== undefined && seconds > 0
          ? `${formatDuration(seconds)} to challenge`
          : undefined,
    },
  }

  const lowBalance = submissionDeposit
    ? balanceBlocker(
        balance,
        BigInt(submissionDeposit.toString()),
        currency,
        'deposit',
      )
    : ''
  const gate: ConfirmGate = wallet.blocker
    ? { blocker: wallet.blocker, fix: wallet.fix }
    : lowBalance
      ? { blocker: lowBalance }
      : {}

  return (
    <SubmitPage
      registryPath={registryPath}
      registryTitle={registryTitle}
      itemName={itemName}
      chainId={chainId ?? undefined}
      lede={
        seconds === undefined
          ? undefined
          : `If your ${itemName} follows the list's policy, it is verified and your deposit comes back.`
      }
      ledeMeta={
        seconds === undefined
          ? undefined
          : seconds > 0
            ? `Challenge period · ${formatDurationLong(seconds)}`
            : 'No challenge period'
      }
      columns={columns}
      initialValues={linkValues}
      disabledFields={NO_DISABLED_FIELDS}
      policyURI={policyURI}
      terms={terms}
      ready={ready}
      gate={gate}
      phase={phase}
      submitting={submitting}
      factoryChecks={factoryChecks}
      onSubmit={submit}
    />
  )
}

const ClassicSubmitPage = () => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const tcrViewContext = useContext(TCRViewContext)
  const tcrError = tcrViewContext?.tcrError

  if (typeof tcrError === 'string')
    return <ErrorPage code="400" message={tcrError} />
  if (!tcrAddress) return <SubmitPageSkeleton />

  return (
    <DepositSubmitPage
      kind="classic"
      tcrAddress={tcrAddress}
      metaEvidence={tcrViewContext?.metaEvidence}
      submissionDeposit={tcrViewContext?.submissionDeposit}
      submissionBaseDeposit={tcrViewContext?.submissionBaseDeposit}
      submissionChallengeBaseDeposit={
        tcrViewContext?.submissionChallengeBaseDeposit
      }
      arbitrationCost={tcrViewContext?.arbitrationCost}
      challengePeriodDuration={tcrViewContext?.challengePeriodDuration}
    />
  )
}

const LightSubmitPage = () => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const tcrViewContext = useContext(LightTCRViewContext)
  const tcrError = tcrViewContext?.tcrError

  if (typeof tcrError === 'string')
    return <ErrorPage code="400" message={tcrError} />
  if (!tcrAddress) return <SubmitPageSkeleton />

  return (
    <DepositSubmitPage
      kind="light"
      tcrAddress={tcrAddress}
      metaEvidence={tcrViewContext?.metaEvidence}
      submissionDeposit={tcrViewContext?.submissionDeposit}
      submissionBaseDeposit={tcrViewContext?.submissionBaseDeposit}
      submissionChallengeBaseDeposit={
        tcrViewContext?.submissionChallengeBaseDeposit
      }
      arbitrationCost={tcrViewContext?.arbitrationCost}
      challengePeriodDuration={tcrViewContext?.challengePeriodDuration}
    />
  )
}

/* ---------- Stake Curate: token stake plus native arbitration cost ---------- */

const PermanentSubmitPage = () => {
  const navigate = useNavigate()
  const registryPath = useRegistryPath()
  const linkValues = useLinkValues()
  const chainId = useUrlChainId()
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const { graphqlBatcher } = useGraphqlBatcher()
  const library = useEthersProvider({
    chainId: chainId ? Number(chainId) : undefined,
  })
  const [columns, setColumns] = useState<Column[]>()
  const [columnsError, setColumnsError] = useState<string>()

  const registryQuery = useQuery({
    queryKey: ['permanentRegistrySubmit', tcrAddress, chainId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_REGISTRY_QUERY,
        variables: { lowerCaseTCRAddress: tcrAddress!.toLowerCase() },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId && !!tcrAddress,
  })

  const registry = registryQuery.data?.registry as SubgraphRegistry | undefined
  const arbitrationSettings = registry?.arbitrationSettings?.[0]
  const metadata = arbitrationSettings?.metadata
  const metaEvidenceURI = arbitrationSettings?.metaEvidenceURI

  useEffect(() => {
    let cancelled = false
    setColumns(undefined)
    setColumnsError(undefined)

    if (!metaEvidenceURI) return undefined
    ;(async () => {
      try {
        const response = await fetch(parseIpfs(metaEvidenceURI))
        const file = await response.json()
        if (!cancelled) setColumns(file?.metadata?.columns || [])
      } catch (err) {
        console.error('Error loading permanent registry meta evidence:', err)
        if (!cancelled)
          setColumnsError('Could not load this registry submission fields.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [metaEvidenceURI])

  const { arbitrationCost } = useArbitrationCost({
    address: registry?.arbitrator?.id || '',
    arbitratorExtraData: arbitrationSettings?.arbitratorExtraData || '',
    library,
  })

  const nativeCurrency = useNativeCurrency()
  const factoryChecks = useFactory()
  const wallet = useWalletGate()
  const {
    symbol,
    decimals,
    loading: tokenLoading,
  } = useTokenSymbol(registry?.token)
  const onDone = useCallback(
    () => navigate(registryPath),
    [navigate, registryPath],
  )
  const stakeCurate = usePermanentSubmit({
    tcrAddress: tcrAddress ?? '',
    tokenAddress: registry?.token,
    submissionDeposit: registry?.submissionMinDeposit,
    arbitrationCost,
    onDone,
  })

  if (registryQuery.isLoading || !registryQuery.data)
    return <SubmitPageSkeleton />
  if (!registry)
    return (
      <ErrorPage
        code="Error"
        title="Registry Not Found"
        message="This permanent registry could not be found on the configured PGTCR subgraph."
      />
    )
  if (columnsError)
    return (
      <ErrorPage
        code="Error"
        title="Metadata unavailable"
        message={columnsError}
      />
    )

  const itemName = metadata?.itemName || 'item'
  const stakeWei =
    registry.submissionMinDeposit === undefined
      ? undefined
      : BigInt(registry.submissionMinDeposit.toString())
  const costWei = arbitrationCost
    ? BigInt(arbitrationCost.toString())
    : undefined
  // The symbol and decimals must be known before any amount is printed.
  const stakeAmount: Amount | undefined =
    stakeWei === undefined || tokenLoading
      ? undefined
      : { value: stakeWei, decimals, symbol }
  const costAmount: Amount | undefined =
    costWei === undefined
      ? undefined
      : { value: costWei, decimals: 18, symbol: nativeCurrency }
  const stake = amountText(stakeAmount)
  const cost = amountText(costAmount)
  const submissionSeconds =
    registry.submissionPeriod === undefined ||
    registry.submissionPeriod === null
      ? undefined
      : Number(registry.submissionPeriod)
  const withdrawingPeriod = registry.withdrawingPeriod
    ? formatDurationLong(Number(registry.withdrawingPeriod))
    : ''
  const ready = !!metadata && !!columns && !!arbitrationCost && !tokenLoading

  const terms: SubmitTerms = {
    headline: stakeAmount,
    extra: { label: 'arbitration deposit', amount: costAmount },
    parts: [
      {
        key: 'stake',
        label: 'Stake, locked while listed',
        amount: stakeAmount,
        tone: 'primary',
      },
      {
        key: 'cost',
        label: 'Arbitration deposit',
        amount: costAmount,
        tone: 'faint',
      },
    ],
    amountText: `${stake} + ${cost}`,
    period:
      submissionSeconds !== undefined && Number.isFinite(submissionSeconds)
        ? {
            seconds: submissionSeconds,
            label: 'Submission period',
            endLabel: 'Accepted',
            noneText: 'No submission period: it is accepted right away.',
          }
        : undefined,
    outcomes: [
      {
        key: 'clear',
        tone: 'registered',
        title: 'No challenge',
        status: 'Accepted',
        figure: `${stake} locked`,
        note: withdrawingPeriod
          ? `withdraw any time; withdrawing takes ${withdrawingPeriod}`
          : 'withdraw any time',
      },
      {
        key: 'challenged',
        tone: 'contested',
        title: 'If challenged',
        status: 'Disputed',
        note: 'possible any time while listed, even while withdrawing',
        children: [
          {
            key: 'win',
            tone: 'registered',
            title: 'Jurors side with you',
            status: 'Accepted',
            note: "your stake grows by the challenger's stake",
          },
          {
            key: 'lose',
            tone: 'off',
            title: 'Jurors side with the challenger',
            status: 'Removed',
            figure: [`−${stake}`, `−${cost}`],
            note: 'the stake is the challenger’s bounty; the arbitration deposit repays their court fee',
          },
        ],
      },
    ],
    status: {
      label: 'Pending',
      detail:
        submissionSeconds !== undefined && submissionSeconds > 0
          ? `${formatDuration(submissionSeconds)} until accepted`
          : undefined,
    },
  }

  const lowStake =
    stakeWei === undefined
      ? ''
      : balanceBlocker(stakeCurate.balance, stakeWei, symbol, 'stake', decimals)
  const lowNative =
    costWei === undefined
      ? ''
      : balanceBlocker(
          stakeCurate.nativeBalance,
          costWei,
          nativeCurrency,
          'arbitration deposit',
        )
  const balancesRead =
    stakeCurate.balance !== undefined &&
    stakeCurate.allowance !== undefined &&
    stakeCurate.nativeBalance !== undefined
  const needsApproval =
    stakeWei !== undefined &&
    stakeCurate.allowance !== undefined &&
    stakeCurate.allowance < stakeWei

  let gate: ConfirmGate = {}
  if (wallet.blocker) gate = { blocker: wallet.blocker, fix: wallet.fix }
  else if (stakeCurate.checkFailed)
    gate = {
      blocker: `Could not read your ${symbol} balance`,
      fix: { label: 'Try again', onClick: stakeCurate.recheck },
    }
  else if (stakeCurate.checking || !balancesRead)
    gate = { blocker: `Checking your ${symbol} balance…` }
  else if (lowStake) gate = { blocker: lowStake }
  else if (lowNative) gate = { blocker: lowNative }
  else if (needsApproval)
    gate = {
      blocker: `Approve ${stake} so the list can lock your stake`,
      fix: {
        label: `Approve ${stake}`,
        onClick: stakeCurate.approve,
        loading: stakeCurate.approving,
      },
    }

  return (
    <SubmitPage
      registryPath={registryPath}
      registryTitle={metadata?.title}
      itemName={itemName}
      chainId={chainId ?? undefined}
      lede={
        tokenLoading
          ? undefined
          : `If your ${itemName} follows the list's policy, it stays listed and you get your stake back when you withdraw.`
      }
      ledeMeta={
        submissionSeconds !== undefined &&
        Number.isFinite(submissionSeconds) &&
        submissionSeconds > 0
          ? `Submission period · ${formatDurationLong(submissionSeconds)}`
          : undefined
      }
      columns={columns}
      initialValues={linkValues}
      disabledFields={NO_DISABLED_FIELDS}
      policyURI={metadata?.policyURI}
      terms={terms}
      ready={ready}
      gate={gate}
      phase={stakeCurate.phase}
      submitting={stakeCurate.submitting}
      factoryChecks={factoryChecks}
      onSubmit={stakeCurate.submit}
    />
  )
}

/* ---------- Kind detection and providers (unchanged) ---------- */

const SubmitItem = () => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate,
    checking,
    error,
    retry,
  } = useCheckLightCurate()
  useTcrNetwork()

  if (checking) return <SubmitPageSkeleton />
  if (error)
    return (
      <ErrorPage
        code="Error"
        title="This list did not load"
        message="The indexer did not answer."
        onRetry={retry}
      />
    )

  if (!tcrAddress)
    return (
      <ErrorPage
        code="Error"
        title="List not found"
        message="No Curate list answers at this address on this chain."
      />
    )

  if (isClassicCurate)
    return (
      <Suspense fallback={<SubmitPageSkeleton />}>
        <TCRViewProvider tcrAddress={tcrAddress}>
          <ClassicSubmitPage />
        </TCRViewProvider>
      </Suspense>
    )

  if (isLightCurate)
    return (
      <Suspense fallback={<SubmitPageSkeleton />}>
        <LightTCRViewProvider tcrAddress={tcrAddress}>
          <LightSubmitPage />
        </LightTCRViewProvider>
      </Suspense>
    )

  if (isPermanentCurate)
    return (
      <Suspense fallback={<SubmitPageSkeleton />}>
        <PermanentSubmitPage />
      </Suspense>
    )

  return (
    <ErrorPage
      code="Error"
      title="Registry Not Found"
      message="This registry could not be found on any subgraph. The subgraph endpoint may be down or the registry address may be invalid."
    />
  )
}

export default SubmitItem
