import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPublicClient, simulateContract } from '@wagmi/core'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { formatEther, isAddress, parseEther } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import EnsureAuth from 'components/ensure-auth'
import Select from 'components/ui/Select'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonAnchor,
  ButtonLink,
  ChainChip,
  Chip,
  Data,
  IconButton,
  Label,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  StatusDot,
  Subheading,
  TextInput,
  truncateMiddle,
} from 'components/curate/primitives'
import { getNativeCurrency } from 'config/chains'
import { klerosAddresses } from 'config/tcr-addresses'
import { appKitModal, wagmiConfig } from 'config/wagmi'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useCourtPolicies from 'hooks/use-court-policies'
import { formatDate } from 'utils/time'
import { fetchRegistryCreationTimes } from 'utils/registry-creation'
import { parseIpfs } from 'utils/ipfs-parse'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { errorToast, wrapWithToast } from 'utils/wrap-with-toast'
import { normalizeAddress, shortAddress } from 'pages/dashboard/data'
import { VerifiedBadge } from 'components/curate/verified-badge'
import {
  SUPPORTED_CHAIN_IDS,
  abiForKind,
  chainName,
  type GovernanceParams,
  type GovernedRegistry,
} from './data'
import { formatInt, kindLabel } from './view'

/*
 * Governed lists: the registries whose governor is the profile address, and
 * the dialog the governor uses to change one parameter at a time. Every
 * write is simulated first, then sent through the wallet with a toast; the
 * contract calls, Atlas upload and court lookup are the same as before.
 */

/* ---------- Parameter plumbing (unchanged) ---------- */

type ParamKind = 'wei' | 'seconds' | 'raw' | 'address' | 'policy'
type ParamKey = keyof GovernanceParams | 'policyURI'

interface ParamConfig {
  key: ParamKey
  label: string
  kind: ParamKind
  functionName: string
  hint?: string
}

// The shared helper, so Gnosis reads "xDAI" here like everywhere else.
const nativeSymbol = (chainId: number) => getNativeCurrency(chainId).symbol

const formatParamValue = (
  value: string | undefined,
  kind: ParamKind,
): string => {
  if (!value) return ''
  if (kind === 'wei')
    try {
      return formatEther(BigInt(value))
    } catch {
      return value
    }
  if (kind === 'seconds') {
    const days = Number(value) / 86_400
    return Number.isFinite(days)
      ? new Intl.NumberFormat('en-US', {
          maximumFractionDigits: days >= 10 ? 1 : 3,
        }).format(days)
      : value
  }
  return value
}

const parseParamValue = (value: string, kind: ParamKind) => {
  if (kind === 'wei') return parseEther(value || '0')
  if (kind === 'seconds')
    return BigInt(Math.max(0, Math.round(Number(value || '0') * 86_400)))
  if (kind === 'raw') return BigInt(value || '0')
  return value
}

const editableParams = (registry: GovernedRegistry): ParamConfig[] => {
  const permanentTokenLabel =
    registry.params?.tokenSymbol ||
    (registry.token ? shortAddress(registry.token) : 'registry token')

  if (registry.kind === 'permanent')
    return [
      {
        key: 'submissionMinDeposit',
        label: `Submission minimum deposit (${permanentTokenLabel})`,
        kind: 'wei',
        functionName: 'changeSubmissionMinDeposit',
        hint: 'Stake Curate lists use their configured staking token, which may differ from the chain native currency.',
      },
      {
        key: 'submissionPeriod',
        label: 'Submission period (days)',
        kind: 'seconds',
        functionName: 'changeSubmissionPeriod',
      },
      {
        key: 'reinclusionPeriod',
        label: 'Reinclusion period (days)',
        kind: 'seconds',
        functionName: 'changeReinclusionPeriod',
      },
      {
        key: 'withdrawingPeriod',
        label: 'Withdrawal period (days)',
        kind: 'seconds',
        functionName: 'changeWithdrawingPeriod',
      },
      {
        key: 'challengeStakeMultiplier',
        label: 'Challenge stake multiplier',
        kind: 'raw',
        functionName: 'changeChallengeStakeMultiplier',
      },
      {
        key: 'winnerStakeMultiplier',
        label: 'Winner appeal multiplier',
        kind: 'raw',
        functionName: 'changeWinnerStakeMultiplier',
      },
      {
        key: 'loserStakeMultiplier',
        label: 'Loser appeal multiplier',
        kind: 'raw',
        functionName: 'changeLoserStakeMultiplier',
      },
      {
        key: 'sharedStakeMultiplier',
        label: 'Shared appeal multiplier',
        kind: 'raw',
        functionName: 'changeSharedStakeMultiplier',
      },
      {
        key: 'governor',
        label: 'Governor address',
        kind: 'address',
        functionName: 'changeGovernor',
      },
    ]

  return [
    ...(registry.kind === 'classic'
      ? [
          {
            key: 'policyURI' as ParamKey,
            label: 'MetaEvidence URI',
            kind: 'policy' as ParamKind,
            functionName: 'changeMetaEvidence',
            hint: 'Advanced: this sets the registration and clearing MetaEvidence to the same URI. A wrong URI can break how the list is displayed.',
          },
        ]
      : []),
    {
      key: 'submissionBaseDeposit',
      label: `Submission deposit (${nativeSymbol(registry.chainId)})`,
      kind: 'wei',
      functionName: 'changeSubmissionBaseDeposit',
    },
    {
      key: 'submissionChallengeBaseDeposit',
      label: `Submission challenge deposit (${nativeSymbol(registry.chainId)})`,
      kind: 'wei',
      functionName: 'changeSubmissionChallengeBaseDeposit',
    },
    {
      key: 'removalBaseDeposit',
      label: `Removal deposit (${nativeSymbol(registry.chainId)})`,
      kind: 'wei',
      functionName: 'changeRemovalBaseDeposit',
    },
    {
      key: 'removalChallengeBaseDeposit',
      label: `Removal challenge deposit (${nativeSymbol(registry.chainId)})`,
      kind: 'wei',
      functionName: 'changeRemovalChallengeBaseDeposit',
    },
    {
      key: 'challengePeriodDuration',
      label: 'Challenge period (days)',
      kind: 'seconds',
      functionName:
        registry.kind === 'light'
          ? 'changeChallengePeriodDuration'
          : 'changeTimeToChallenge',
    },
    {
      key: 'winnerStakeMultiplier',
      label: 'Winner appeal multiplier',
      kind: 'raw',
      functionName: 'changeWinnerStakeMultiplier',
    },
    {
      key: 'loserStakeMultiplier',
      label: 'Loser appeal multiplier',
      kind: 'raw',
      functionName: 'changeLoserStakeMultiplier',
    },
    {
      key: 'sharedStakeMultiplier',
      label: 'Shared appeal multiplier',
      kind: 'raw',
      functionName: 'changeSharedStakeMultiplier',
    },
    {
      key: 'connectedTCR',
      label: 'Connected TCR address',
      kind: 'address',
      functionName: 'changeConnectedTCR',
      hint: 'Optional contract hook for connected registry flows. Leave it unless your list uses one.',
    },
    ...(registry.kind === 'light'
      ? [
          {
            key: 'relayerContract' as ParamKey,
            label: 'Relayer contract address',
            kind: 'address' as ParamKind,
            functionName: 'changeRelayerContract',
            hint: 'Optional relayer for delegated Light Curate submissions.',
          },
        ]
      : []),
    {
      key: 'governor',
      label: 'Governor address',
      kind: 'address',
      functionName: 'changeGovernor',
    },
  ]
}

const buildArgs = (
  registry: GovernedRegistry,
  config: ParamConfig,
  value: string,
) => {
  if (config.kind === 'policy') {
    if (registry.kind === 'classic') return [value, value]
    if (registry.kind === 'light')
      return [
        registry.params?.arbitrator,
        registry.params?.arbitratorExtraData || '0x',
        value,
        value,
      ]
    return [registry.params?.arbitratorExtraData || '0x', value]
  }
  return [parseParamValue(value, config.kind)]
}

const buildArbitratorExtraData = (courtID: string, jurors: string) =>
  `0x${Number(courtID || 0)
    .toString(16)
    .padStart(64, '0')}${Math.max(1, Math.ceil(Number(jurors || 1)))
    .toString(16)
    .padStart(64, '0')}`

/* ---------- Dialog shell ---------- */

const backdropIn = keyframes`
  from { opacity: 0; }
`

const dialogIn = keyframes`
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
`

const sheetIn = keyframes`
  from { transform: translateY(100%); }
`

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  overflow-y: auto;

  @media (max-width: 720px) {
    align-items: flex-end;
    padding: 0;
  }
`

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--stage) 62%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: ${backdropIn} 240ms ease both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Dialog = styled.div`
  position: relative;
  width: 100%;
  max-width: 760px;
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  outline: none;
  animation: ${dialogIn} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;

  @media (max-width: 720px) {
    max-width: none;
    max-height: 92vh;
    overflow-y: auto;
    border-radius: 24px 24px 0 0;
    animation: ${sheetIn} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const DialogHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--glass-border);

  h3 {
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
`

const DialogBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 24px;

  @media (max-width: 720px) {
    padding: 16px;
  }
`

/** What Tab can land on inside the dialog; the dialog itself (tabindex -1) is excluded. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

const DialogShell = ({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // The latest close handler, so the mount effect never re-runs (and never
  // steals focus from a field) when the panel re-renders behind the dialog.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Keep Tab inside the dialog: wrap from the last field to the first
      // and back, and pull focus in if it ever lands on the page behind.
      const dialog = dialogRef.current
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && dialog.contains(active)
      if (event.shiftKey) {
        if (!inside || active === first || active === dialog) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <Layer>
      <Backdrop onClick={onClose} aria-hidden />
      <Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <DialogHead>
          <Subheading id={titleId}>{title}</Subheading>
          <IconButton type="button" aria-label="Close" onClick={onClose}>
            <CurateIcon name="close" size={16} />
          </IconButton>
        </DialogHead>
        <DialogBody>{children}</DialogBody>
      </Dialog>
    </Layer>,
    document.body,
  )
}

/* ---------- Form chrome ---------- */

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid var(--glass-border);
`

const FieldLabel = styled.label`
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
`

const Controls = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const TwoUp = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

/* The app's glass Select, at the field's full width. */
const CourtSelect = styled(Select)`
  display: block;
  width: 100%;
  min-width: 0;

  .ui-select-trigger {
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
`

const HiddenFileInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const GateRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
`

/** What stops a save right now, if anything. */
interface SaveGate {
  blocker?: string
  helper?: { label: string; onClick: () => void; loading?: boolean }
}

/* ---------- Arbitration and court (plumbing unchanged) ---------- */

const ArbitrationGovernanceField = ({
  registry,
  gate,
  onSaved,
}: {
  registry: GovernedRegistry
  gate: SaveGate
  onSaved: () => void
}) => {
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const chainProvider = useEthersProvider({ chainId: registry.chainId })
  const knownKleros = klerosAddresses[registry.chainId]
  const [arbitrator, setArbitrator] = useState(
    registry.params?.arbitrator || knownKleros?.arbitrator || '',
  )
  const courtArbitrator =
    registry.kind === 'permanent' ? knownKleros?.arbitrator : arbitrator
  const { data: courts = [] } = useCourtPolicies(
    knownKleros?.policy,
    chainProvider ?? null,
    courtArbitrator,
  )
  const currentMetaEvidenceURI =
    registry.params?.metaEvidenceURI || registry.metaEvidenceURI || ''
  const [extraData, setExtraData] = useState(
    registry.params?.arbitratorExtraData || '0x',
  )
  const [courtID, setCourtID] = useState('')
  const [jurors, setJurors] = useState('3')
  const [registrationMetaEvidence, setRegistrationMetaEvidence] = useState('')
  const [clearingMetaEvidence, setClearingMetaEvidence] = useState('')
  const [metaEvidence, setMetaEvidence] = useState(currentMetaEvidenceURI)
  const [pending, setPending] = useState(false)
  const ids = useId()

  useEffect(() => {
    if (!extraData || extraData === '0x') return
    const decoded = jurorsAndCourtIDFromExtraData(extraData)
    setCourtID(String(decoded.courtID))
    setJurors(String(decoded.numberOfJurors))
  }, [extraData])

  const updateCourt = (nextCourtID: string) => {
    setCourtID(nextCourtID)
    if (!Number.isNaN(Number(nextCourtID)))
      setExtraData(buildArbitratorExtraData(nextCourtID, jurors))
  }

  const updateJurors = (nextJurors: string) => {
    const normalized = Math.max(1, Math.min(33, Number(nextJurors || 1)))
    const oddJurors = normalized % 2 === 0 ? normalized - 1 : normalized
    setJurors(String(oddJurors))
    if (courtID !== '')
      setExtraData(buildArbitratorExtraData(courtID, String(oddJurors)))
  }

  const save = async () => {
    if (registry.kind !== 'permanent' && !isAddress(arbitrator)) {
      errorToast('Enter a valid arbitrator address.')
      return
    }
    if (
      registry.kind === 'light' &&
      (!registrationMetaEvidence.trim() || !clearingMetaEvidence.trim())
    ) {
      errorToast('Light Curate lists need both MetaEvidence URIs.')
      return
    }
    if (registry.kind === 'permanent' && !metaEvidence.trim()) {
      errorToast('Stake Curate lists need a MetaEvidence URI.')
      return
    }

    const functionName =
      registry.kind === 'classic'
        ? 'changeArbitrator'
        : 'changeArbitrationParams'
    const args =
      registry.kind === 'classic'
        ? [arbitrator, extraData || '0x']
        : registry.kind === 'light'
          ? [
              arbitrator,
              extraData || '0x',
              registrationMetaEvidence,
              clearingMetaEvidence,
            ]
          : [extraData || '0x', metaEvidence]

    setPending(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        chainId: registry.chainId,
        address: registry.address as `0x${string}`,
        abi: abiForKind(registry.kind),
        functionName,
        args,
      } as any)
      const publicClient = getPublicClient(wagmiConfig, {
        chainId: registry.chainId,
      })
      const result = await wrapWithToast(
        () => walletClient!.writeContract(request),
        publicClient!,
      )
      if (result.status) {
        onSaved()
        queryClient.invalidateQueries({ queryKey: ['addressProfile'] })
      }
    } finally {
      setPending(false)
    }
  }

  const locked = Boolean(gate.blocker) || pending
  const disabled = locked || !walletClient
  const blocker =
    gate.blocker ?? (!walletClient ? 'Wallet not ready' : undefined)
  const selectedCourt = courts.find(
    (court) => String(court.courtID) === courtID,
  )
  const symbol = nativeSymbol(registry.chainId)
  const feePerJuror = selectedCourt?.feeForJuror
    ? Number(formatEther(BigInt(selectedCourt.feeForJuror))).toLocaleString(
        undefined,
        { maximumFractionDigits: 6 },
      )
    : null

  return (
    <Field>
      <div>
        <FieldLabel as="div">
          {registry.kind === 'permanent'
            ? 'Court and MetaEvidence'
            : 'Arbitrator and court'}
        </FieldLabel>
        <Small $muted>
          Choosing a court rewrites the arbitrator extra data. Light and Stake
          Curate contracts update the court together with the MetaEvidence, so
          those URIs are required here. An invalid URI can break how the list is
          displayed.
        </Small>
      </div>
      <Controls>
        <Stack $gap={8}>
          {registry.kind !== 'permanent' && (
            <TextInput
              value={arbitrator}
              disabled={locked}
              onChange={(event) => setArbitrator(event.currentTarget.value)}
              placeholder="Arbitrator address"
              aria-label="Arbitrator address"
            />
          )}
          <TwoUp>
            <Stack $gap={4}>
              <Label
                as="label"
                id={`${ids}-court-label`}
                htmlFor={`${ids}-court`}
              >
                Court
              </Label>
              <CourtSelect
                id={`${ids}-court`}
                aria-labelledby={`${ids}-court-label`}
                value={courtID}
                disabled={locked || courts.length === 0}
                placeholder={
                  courts.length > 0 ? 'Select court' : 'Court list unavailable'
                }
                onChange={(value) =>
                  updateCourt(
                    String(typeof value === 'object' ? value.key : value),
                  )
                }
              >
                {courts.map((court) => (
                  <Select.Option key={court.value} value={String(court.value)}>
                    {court.label} · ID {court.courtID}
                  </Select.Option>
                ))}
              </CourtSelect>
            </Stack>
            <Stack $gap={4}>
              <Label as="label" htmlFor={`${ids}-jurors`}>
                Number of jurors
              </Label>
              <TextInput
                id={`${ids}-jurors`}
                value={jurors}
                disabled={locked}
                onChange={(event) => updateJurors(event.currentTarget.value)}
                placeholder="Number of jurors"
                inputMode="numeric"
              />
            </Stack>
          </TwoUp>
          {selectedCourt && (
            <Small $muted>
              {selectedCourt.summary ||
                `${selectedCourt.label} handles disputes sent to this court.`}{' '}
              Fee per juror:{' '}
              <Data $weight={500}>
                {feePerJuror ? `${feePerJuror} ${symbol}` : 'unavailable'}
              </Data>
            </Small>
          )}
          <TextInput
            value={extraData}
            disabled
            readOnly
            aria-label="Arbitrator extra data"
            placeholder="Arbitrator extra data is generated from the court"
          />
          {registry.kind === 'light' && (
            <TwoUp>
              <TextInput
                value={registrationMetaEvidence}
                disabled={locked}
                onChange={(event) =>
                  setRegistrationMetaEvidence(event.currentTarget.value)
                }
                placeholder="Registration MetaEvidence URI"
                aria-label="Registration MetaEvidence URI"
              />
              <TextInput
                value={clearingMetaEvidence}
                disabled={locked}
                onChange={(event) =>
                  setClearingMetaEvidence(event.currentTarget.value)
                }
                placeholder="Clearing MetaEvidence URI"
                aria-label="Clearing MetaEvidence URI"
              />
            </TwoUp>
          )}
          {registry.kind === 'permanent' && (
            <TextInput
              value={metaEvidence}
              disabled={locked}
              onChange={(event) => setMetaEvidence(event.currentTarget.value)}
              placeholder="MetaEvidence URI"
              aria-label="MetaEvidence URI"
            />
          )}
        </Stack>
        <Button
          type="button"
          $variant="primary"
          disabled={disabled}
          title={blocker}
          onClick={save}
        >
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </Controls>
    </Field>
  )
}

/* ---------- One parameter (plumbing unchanged) ---------- */

const GovernanceField = ({
  registry,
  config,
  gate,
  onSaved,
}: {
  registry: GovernedRegistry
  config: ParamConfig
  gate: SaveGate
  onSaved: () => void
}) => {
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const inputId = useId()
  const [value, setValue] = useState(() =>
    formatParamValue(
      config.key === 'policyURI' ? '' : registry.params?.[config.key],
      config.kind,
    ),
  )
  const [pending, setPending] = useState(false)
  const [uploading, setUploading] = useState(false)

  const locked = Boolean(gate.blocker) || pending || uploading
  const disabled =
    locked || !walletClient || (config.kind === 'policy' && !value.trim())
  const blocker =
    gate.blocker ??
    (!walletClient
      ? 'Wallet not ready'
      : config.kind === 'policy' && !value.trim()
        ? 'Enter or upload a MetaEvidence URI'
        : undefined)

  const uploadMetaEvidence = async (file?: File) => {
    if (!file) return
    if (
      file.type !== 'application/json' &&
      !file.name.toLowerCase().endsWith('.json')
    ) {
      errorToast('Upload a MetaEvidence JSON file.')
      return
    }
    setUploading(true)
    try {
      const uri = await uploadFile(file, JSON_UPLOAD_ROLE)
      if (!uri) throw new Error('Atlas upload failed.')
      setValue(uri)
    } catch (err) {
      console.error(err)
      errorToast('MetaEvidence upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (config.kind === 'address' && !isAddress(value)) {
      errorToast('Enter a valid address.')
      return
    }

    const args = buildArgs(registry, config, value)
    if (args.some((arg) => arg === undefined || arg === '')) {
      errorToast('Missing current arbitration parameters for this update.')
      return
    }

    setPending(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        chainId: registry.chainId,
        address: registry.address as `0x${string}`,
        abi: abiForKind(registry.kind),
        functionName: config.functionName,
        args,
      } as any)
      const publicClient = getPublicClient(wagmiConfig, {
        chainId: registry.chainId,
      })
      const result = await wrapWithToast(
        () => walletClient!.writeContract(request),
        publicClient!,
      )
      if (result.status) onSaved()
    } finally {
      setPending(false)
    }
  }

  const placeholder =
    config.kind === 'policy'
      ? '/ipfs/… or https://…'
      : config.kind === 'seconds'
        ? 'days'
        : undefined

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{config.label}</FieldLabel>
      <Controls>
        <Stack $gap={8}>
          <TextInput
            id={inputId}
            value={value}
            placeholder={placeholder}
            disabled={locked}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
          {config.kind === 'policy' && (
            <Row $gap={8} $wrap>
              <EnsureAuth>
                <ButtonAnchor
                  as="label"
                  $variant="secondary"
                  $size="sm"
                  aria-disabled={locked}
                >
                  <CurateIcon name="submit" size={14} />
                  {uploading ? 'Uploading…' : 'Upload MetaEvidence JSON'}
                  <HiddenFileInput
                    type="file"
                    accept="application/json,.json"
                    disabled={locked}
                    onChange={(event) =>
                      uploadMetaEvidence(event.currentTarget.files?.[0])
                    }
                  />
                </ButtonAnchor>
              </EnsureAuth>
            </Row>
          )}
        </Stack>
        <Button
          type="button"
          $variant="primary"
          disabled={disabled}
          title={blocker}
          onClick={save}
        >
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </Controls>
      {config.hint && <Small $muted>{config.hint}</Small>}
    </Field>
  )
}

/* ---------- Update dialog ---------- */

const GovernanceDialog = ({
  registry,
  editable,
  profileAddress,
  onClose,
}: {
  registry: GovernedRegistry
  editable: boolean
  profileAddress: string
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const { chainId: walletChainId } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const wrongChain = editable && walletChainId !== registry.chainId
  const gate: SaveGate = !editable
    ? { blocker: 'Only the governor wallet can save changes' }
    : wrongChain
      ? {
          blocker: `Switch to ${chainName(registry.chainId)} to save`,
          helper: {
            label: `Switch to ${chainName(registry.chainId)}`,
            onClick: () => switchChain({ chainId: registry.chainId }),
            loading: switching,
          },
        }
      : {}
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['addressProfile', profileAddress],
    })

  return (
    <DialogShell title={`Update ${registry.title}`} onClose={onClose}>
      <Small $muted>
        Changes are sent one parameter at a time. Each is simulated before the
        wallet asks you to sign, so a change that would revert is caught before
        you pay gas.
      </Small>
      {gate.blocker && (
        <GateRow>
          <Small $muted role="status">
            {gate.blocker}
          </Small>
          {gate.helper && (
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              disabled={gate.helper.loading}
              onClick={gate.helper.onClick}
            >
              {gate.helper.loading ? 'Waiting…' : gate.helper.label}
            </Button>
          )}
        </GateRow>
      )}
      <div>
        <Label>Arbitration and court</Label>
        <ArbitrationGovernanceField
          registry={registry}
          gate={gate}
          onSaved={invalidate}
        />
      </div>
      <div>
        <Label>Registry parameters</Label>
        {editableParams(registry).map((config) => (
          <GovernanceField
            key={`${registry.id}-${config.key}`}
            registry={registry}
            config={config}
            gate={gate}
            onSaved={invalidate}
          />
        ))}
      </div>
    </DialogShell>
  )
}

/* ---------- Court of a governed list (plumbing unchanged) ---------- */

const CourtDisplay = ({ registry }: { registry: GovernedRegistry }) => {
  const extraData =
    registry.params?.arbitratorExtraData || registry.arbitratorExtraData
  const knownKleros = klerosAddresses[registry.chainId]
  const chainProvider = useEthersProvider({ chainId: registry.chainId })
  const { data: courts = [] } = useCourtPolicies(
    knownKleros?.policy,
    chainProvider ?? null,
  )

  if (!extraData || extraData === '0x') return <>Unavailable</>

  let decoded: ReturnType<typeof jurorsAndCourtIDFromExtraData>
  try {
    decoded = jurorsAndCourtIDFromExtraData(extraData)
  } catch {
    return <>Court data unavailable</>
  }
  const court = courts.find(
    (item) => String(item.courtID) === String(decoded.courtID),
  )

  return (
    <>
      {court?.label || 'Court'}
      {` · ID ${decoded.courtID}`}
      {decoded.numberOfJurors
        ? ` · ${decoded.numberOfJurors} ${Number(decoded.numberOfJurors) === 1 ? 'juror' : 'jurors'}`
        : ''}
    </>
  )
}

/* ---------- Panel ---------- */

const GovList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const GovRow = styled.li`
  display: grid;
  grid-template-columns: 40px minmax(0, 1.2fr) minmax(0, 1.4fr) auto;
  align-items: center;
  gap: 16px 20px;
  min-height: 76px;
  padding: 16px 16px 16px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition:
    border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);

  &:hover {
    border-color: var(--color-border-strong);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-card-hover);
  }

  @media (max-width: 980px) {
    grid-template-columns: 40px minmax(0, 1fr);

    > :nth-child(n + 3) {
      grid-column: 1 / -1;
    }
  }
`

const GovName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  small {
    color: var(--color-faint);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 16px;
  }
`

/** The list's name, then its Kleros Verified seal; the name gives way first. */
const TitleLine = styled.span`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;

  > a {
    flex: 0 1 auto;
    min-width: 0;
  }
`

const RegistryTitle = styled(Link)`
  display: block;
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--motion);

  &:hover {
    color: var(--color-primary);
  }
`

const Facts = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) auto auto;
  gap: 4px 24px;
  margin: 0;
  min-width: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  dd {
    margin: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr) auto;

    div:first-child {
      grid-column: 1 / -1;
    }
  }
`

const GovActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;

  @media (max-width: 980px) {
    justify-content: flex-start;
  }
`

const GovLogo = styled.span<{ $image?: string | null }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: ${({ $image }) =>
    $image ? `url("${$image}") center / cover` : 'var(--color-surface)'};
  color: var(--color-faint);
`

const GovHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 72px 0 20px;

  h2 {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 30px;
    line-height: 34px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  h2 small {
    color: var(--color-faint);
    font-family: var(--font-figure);
    font-size: 16px;
    line-height: 1;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  p {
    flex-basis: 100%;
    margin: -4px 0 0;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 720px) {
    margin-top: 48px;

    h2 {
      font-size: 26px;
      line-height: 30px;
    }
  }
`

const logoUrl = (uri?: string | null): string | null => {
  if (!uri) return null
  if (/^https?:\/\//i.test(uri)) return uri
  return parseIpfs(uri)
}

/** The creation date, a placeholder while it is read, or a dash. */
const CreatedValue = ({
  time,
  pending,
}: {
  time?: number
  pending: boolean
}) =>
  time ? (
    <>{formatDate(time)}</>
  ) : pending ? (
    <SkeletonBlock $width="84px" $height="16px" aria-hidden />
  ) : (
    <>—</>
  )

export const GovernancePanel = ({
  registries,
  profileAddress,
  loading,
  isZero = false,
}: {
  registries: GovernedRegistry[]
  profileAddress: string
  loading?: boolean
  /** The zero address: its lists can no longer change parameters. */
  isZero?: boolean
}) => {
  const { address: connectedAddress, isConnected } = useAccount()
  const [selected, setSelected] = useState<GovernedRegistry | null>(null)
  const connected = normalizeAddress(connectedAddress)
  const isOwner = isConnected && connected === profileAddress
  const selectedEditable =
    isOwner && normalizeAddress(selected?.governor) === connected

  // A list's creation is the factory's NewGTCR block time (cached once read;
  // the same query as Browse), never its first request: until the time is
  // known, the date waits. Stake lists carry their own creation time.
  const creation = useQuery({
    queryKey: ['registryCreationTimes'],
    queryFn: () => fetchRegistryCreationTimes(SUPPORTED_CHAIN_IDS),
    staleTime: 10 * 60_000,
  })
  const createdAt = (registry: GovernedRegistry): number | undefined =>
    registry.kind === 'permanent'
      ? registry.createdAt
      : (creation.data?.get(
          `${registry.chainId}:${registry.address.toLowerCase()}`,
        ) ?? (registry.createdAtExact ? registry.createdAt : undefined))

  return (
    <section aria-label="Governed lists">
      <GovHead>
        <h2>
          Governed lists
          {!loading && registries.length > 0 && (
            <small>{formatInt(registries.length)}</small>
          )}
        </h2>
        <p>
          {isZero && registries.length > 0
            ? 'Lists whose governor is the zero address: nobody can change their parameters any more.'
            : 'Lists whose governor is this address. Only the governor wallet can change their deposits, periods, court and policy.'}
        </p>
      </GovHead>

      {loading ? (
        <GovList aria-busy="true">
          <Small $muted role="status">
            Scanning indexed lists for this governor…
          </Small>
          <SkeletonBlock $height="76px" style={{ borderRadius: 14 }} />
        </GovList>
      ) : (
        <GovList>
          {registries.map((registry) => {
            const editable =
              isOwner && normalizeAddress(registry.governor) === connected
            const href = `/tcr/${registry.chainId}/${registry.address}`
            const image = logoUrl(registry.logoURI)
            return (
              <GovRow key={registry.id}>
                <GovLogo $image={image} aria-hidden>
                  {!image && <CurateIcon name="registry" size={17} />}
                </GovLogo>
                <GovName>
                  <TitleLine>
                    <RegistryTitle to={href}>{registry.title}</RegistryTitle>
                    {registry.trustStatus === 'verified' && (
                      <VerifiedBadge size={16} />
                    )}
                  </TitleLine>
                  <Row $gap={6} $wrap>
                    <ChainChip chainId={registry.chainId} size="sm" />
                    <small>
                      {kindLabel(registry.kind)} ·{' '}
                      {truncateMiddle(registry.address)}
                    </small>
                    {editable && (
                      <Chip>
                        <StatusDot $tone="registered" aria-hidden /> You govern
                        this list
                      </Chip>
                    )}
                  </Row>
                </GovName>
                <Facts>
                  <div>
                    <Label as="dt" $tone="faint">
                      Court
                    </Label>
                    <dd>
                      <CourtDisplay registry={registry} />
                    </dd>
                  </div>
                  <div>
                    <Label as="dt" $tone="faint">
                      Entries
                    </Label>
                    <dd>{formatInt(registry.itemCount)}</dd>
                  </div>
                  <div>
                    <Label as="dt" $tone="faint">
                      Created
                    </Label>
                    <dd>
                      <CreatedValue
                        time={createdAt(registry)}
                        pending={creation.isPending}
                      />
                    </dd>
                  </div>
                </Facts>
                <GovActions>
                  {isZero ? (
                    // Nobody holds the zero address's key: there is no
                    // update to offer, only the list to open.
                    <Chip title="The governor is the zero address, so these parameters can no longer change">
                      <StatusDot $tone="neutral" aria-hidden />
                      Governance renounced
                    </Chip>
                  ) : editable ? (
                    <Button
                      type="button"
                      $variant="primary"
                      $size="sm"
                      onClick={() => setSelected(registry)}
                    >
                      Update parameters
                    </Button>
                  ) : isConnected ? (
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      disabled
                      title="Connect the governor wallet to update this list"
                    >
                      Only the governor can update
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => appKitModal?.open({ view: 'Connect' })}
                    >
                      Connect wallet to update
                    </Button>
                  )}
                  <ButtonLink to={href} $variant="ghost" $size="sm">
                    Open list
                  </ButtonLink>
                </GovActions>
              </GovRow>
            )
          })}
        </GovList>
      )}

      {selected && (
        <GovernanceDialog
          registry={selected}
          editable={selectedEditable}
          profileAddress={profileAddress}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}

export default GovernancePanel
