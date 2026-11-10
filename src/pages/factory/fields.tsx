import React, { useCallback, useId, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { useField } from 'formik'
import { toast } from 'react-toastify'
import { ethers, BigNumber, type BigNumberish } from 'ethers'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { appKitModal } from 'config/wagmi'
import { NETWORKS_INFO } from 'config/networks'
import useUrlChainId from 'hooks/use-url-chain-id'
import { parseIpfs } from 'utils/ipfs-parse'
import { errorToast, infoToast, successToast } from 'utils/wrap-with-toast'
import { CurateIcon } from 'components/curate/icons'
import KitSelect from 'components/ui/Select'
import Switch from 'components/ui/Switch'
import { reveal } from 'components/curate/motion/reveal'
import {
  Button,
  Data,
  Label,
  Row,
  Small,
  TextInput,
  truncateMiddle,
} from 'components/curate/primitives'

/*
 * The wizard's form controls: a labelled field with one line of plain help
 * and the validation message inline, text and number inputs, a select, a
 * switch, a range slider with a lit fill and the IPFS upload through Atlas.
 * Formik binding goes through `useField`, so the steps keep their
 * `withFormik` wrappers and yup schemas.
 */

/* ---------- Amounts ---------- */

/** "0.05" from a wei amount, trailing zeros trimmed; null while unknown. */
export const formatNative = (
  amount: BigNumberish | null | undefined,
): string | null => {
  if (amount === null || amount === undefined) return null
  const integer =
    typeof amount === 'number'
      ? amount.toLocaleString('fullwide', { useGrouping: false })
      : String(amount)
  return ethers.utils.formatEther(integer).replace(/\.?0+$/, '')
}

/** base + arbitration cost in wei, or null while either is unknown or invalid. */
export const totalDeposit = (
  base: unknown,
  arbitrationCost: BigNumberish | null | undefined,
): BigNumber | null => {
  if (arbitrationCost === null || arbitrationCost === undefined) return null
  try {
    return ethers.utils
      .parseEther(String(base ?? '0'))
      .add(BigNumber.from(arbitrationCost))
  } catch {
    return null
  }
}

/** For a count-up: intermediate values at the amount's precision, then the exact string. */
export const amountFormat = (exact: string) => {
  const decimals = Math.min(6, (exact.split('.')[1] ?? '').length)
  const target = Number(exact)
  return (n: number) => (n === target ? exact : n.toFixed(decimals))
}

/* ---------- Layout ---------- */

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

const FieldHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const FieldLabel = styled.label`
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

export const Help = styled.p`
  margin: 0;
  max-width: 72ch;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

export const ErrorText = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  &::before {
    content: '';
    flex: 0 0 auto;
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--color-danger);
    box-shadow: 0 0 0 3px var(--color-danger-soft);
  }
`

export const Input = styled(TextInput)`
  &[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  &[aria-invalid='true']:focus {
    box-shadow: 0 0 0 4px var(--color-danger-soft);
  }

  &:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
    opacity: 0.7;
  }
`

export const MonoInput = styled(Input)`
  font-family: var(--font-mono);
  font-size: var(--fs-data);
  font-variant-numeric: tabular-nums;
`

/** Two columns from 720px up; fields inside a step sit side by side. */
export const FieldGrid = styled.div<{ $columns?: 2 | 3 }>`
  display: grid;
  grid-template-columns: repeat(
    ${({ $columns }) => $columns ?? 2},
    minmax(0, 1fr)
  );
  gap: 20px 24px;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

/** Shown only where the sticky preview is not beside the form. */
export const NarrowOnly = styled.div`
  display: none;

  @media (max-width: 1080px) {
    display: block;
  }
`

/** The step body: each child rises in, staggered, when a step opens. */
export const StepBody = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap }) => $gap ?? 24}px;

  > * {
    ${reveal}
  }

  > *:nth-child(1) {
    --i: 0;
  }
  > *:nth-child(2) {
    --i: 1;
  }
  > *:nth-child(3) {
    --i: 2;
  }
  > *:nth-child(4) {
    --i: 3;
  }
  > *:nth-child(n + 5) {
    --i: 4;
  }
`

/* The kit's glass Select at the width and type size of the inputs around it. */
const SelectField = styled(KitSelect)`
  display: block;
  width: 100%;
  min-width: 0;

  .ui-select-trigger {
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
`

export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

/**
 * A form dropdown: the app's Select (a field trigger opening a glass
 * listbox), not a native <select>. `placeholder` shows while `value` is ''.
 */
export const Select = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  menuMinWidth,
  ...a11y
}: {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** A floor for the option panel's width when the field is narrow. */
  menuMinWidth?: number
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
}) => (
  <SelectField
    {...a11y}
    value={value}
    disabled={disabled}
    placeholder={placeholder}
    dropdownStyle={menuMinWidth ? { minWidth: menuMinWidth } : undefined}
    onChange={(next) =>
      onChange(String(typeof next === 'object' ? next.key : next))
    }
  >
    {options.map((option) => (
      <KitSelect.Option
        key={option.value}
        value={option.value}
        disabled={option.disabled}
      >
        {option.label}
      </KitSelect.Option>
    ))}
  </SelectField>
)

const UnitRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  ${Input} {
    flex: 1;
  }
`

const thumb = css`
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow:
    0 0 0 4px var(--color-primary-soft),
    0 0 14px color-mix(in srgb, var(--color-primary) 60%, transparent);
  transition: transform var(--motion);
`

const RangeControl = styled.input`
  flex: 1;
  min-width: 0;
  height: 24px;
  margin: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      90deg,
      var(--aurora-b),
      var(--color-primary) var(--fill, 0%),
      var(--color-raised) var(--fill, 0%)
    );
    box-shadow: inset 0 0 0 1px var(--glass-border);
  }

  &::-moz-range-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--color-raised);
    box-shadow: inset 0 0 0 1px var(--glass-border);
  }

  &::-moz-range-progress {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, var(--aurora-b), var(--color-primary));
  }

  &::-webkit-slider-thumb {
    margin-top: -7px;
    appearance: none;
    ${thumb}
  }

  &::-moz-range-thumb {
    ${thumb}
  }

  &:hover::-webkit-slider-thumb,
  &:focus-visible::-webkit-slider-thumb {
    transform: scale(1.12);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

/** Range slider: the filled part of the track lights up to the thumb. */
export const RangeInput = (
  props: React.InputHTMLAttributes<HTMLInputElement>,
) => {
  const min = Number(props.min ?? 0)
  const max = Number(props.max ?? 100)
  const value = Number(props.value ?? min)
  const fill =
    max > min
      ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
      : 0
  return (
    <RangeControl
      {...props}
      type="range"
      style={{ ...props.style, ['--fill' as string]: `${fill}%` }}
    />
  )
}

const SwitchRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  cursor: pointer;
`

const SwitchText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

const UploadRow = styled.div<{ $empty: boolean }>`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 12px 12px 12px;
  border: 1px ${({ $empty }) => ($empty ? 'dashed' : 'solid')}
    ${({ $empty }) =>
      $empty ? 'var(--color-border-strong)' : 'var(--glass-border)'};
  border-radius: var(--radius);
  background: var(--color-raised);
  transition: border-color var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
  }

  &[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  @media (max-width: 520px) {
    grid-template-columns: 48px minmax(0, 1fr);

    > :last-child {
      grid-column: 1 / -1;
    }
  }
`

const Thumb = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-faint);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @media (max-width: 520px) {
    width: 48px;
    height: 48px;
  }
`

const UploadMeta = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
  }
`

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/**
 * An image from IPFS or a list's meta-evidence, rendered as <img> (never
 * interpolated into CSS); if it fails to load, the fallback shows instead.
 */
export const SafeImage = ({
  src,
  alt,
  fallback,
}: {
  src?: string
  alt: string
  fallback: React.ReactNode
}) => {
  const [failed, setFailed] = useState<string>()
  if (!src || failed === src) return <>{fallback}</>
  return <img src={src} alt={alt} onError={() => setFailed(src)} />
}

/** Text for screen readers only (a dash's meaning, an icon's name). */
export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

export const TextLink = styled.a`
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

/** A quiet raised block inside a step (no border, no nested panel). */
export const Note = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--color-raised);
`

/** Hairline between groups of fields, with an optional small label. */
export const Divider = ({ label }: { label?: React.ReactNode }) => (
  <DividerShell role="separator">
    {label && <Label $tone="faint">{label}</Label>}
  </DividerShell>
)

const DividerShell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--glass-border);
  }
`

/* ---------- Step header ---------- */

const HeaderShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const StepTitle = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 1vw + 16px, 30px);
  line-height: 1.12;
  font-weight: 500;
  letter-spacing: -0.03em;
`

const StepLede = styled.p`
  margin: 0;
  max-width: 60ch;
  color: var(--color-muted);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
`

export const StepHeader = ({
  eyebrow,
  heading,
  lede,
}: {
  eyebrow?: React.ReactNode
  heading: string
  lede?: React.ReactNode
}) => (
  <HeaderShell>
    {eyebrow && <Label $tone="primary">{eyebrow}</Label>}
    <StepTitle>{heading}</StepTitle>
    {lede && <StepLede>{lede}</StepLede>}
  </HeaderShell>
)

/* ---------- Field wrapper ---------- */

export interface FieldA11y {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

export const FormField = ({
  id,
  label,
  help,
  error,
  showError,
  children,
}: {
  id: string
  label: React.ReactNode
  help?: React.ReactNode
  error?: string
  showError?: boolean
  children: (a11y: FieldA11y) => React.ReactNode
}) => {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const invalid = !!showError && !!error
  const describedBy =
    [help ? helpId : '', invalid ? errorId : ''].filter(Boolean).join(' ') ||
    undefined
  return (
    <Shell>
      <FieldHead>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help && <Help id={helpId}>{help}</Help>}
      </FieldHead>
      {children({
        id,
        'aria-invalid': invalid || undefined,
        'aria-describedby': describedBy,
      })}
      {invalid && <ErrorText id={errorId}>{error}</ErrorText>}
    </Shell>
  )
}

/* ---------- Formik-bound text field ---------- */

export const TextField = ({
  name,
  label,
  help,
  placeholder,
  unit,
  mono,
  numeric,
  trailing,
}: {
  name: string
  label: React.ReactNode
  help?: React.ReactNode
  placeholder?: string
  /** A unit after the input: the currency, "hours", "%". */
  unit?: React.ReactNode
  mono?: boolean
  numeric?: boolean
  /** Extra content under the input, e.g. the total with the arbitration cost. */
  trailing?: React.ReactNode
}) => {
  const id = useId()
  const [field, meta] = useField<string | number | undefined>(name)
  const Control = mono ? MonoInput : Input
  const value =
    field.value === undefined || field.value === null ? '' : String(field.value)
  return (
    <FormField
      id={id}
      label={label}
      help={help}
      error={meta.error}
      showError={meta.touched}
    >
      {(a11y) => (
        <>
          <UnitRow>
            <Control
              {...a11y}
              type="text"
              name={field.name}
              value={value}
              placeholder={placeholder}
              inputMode={numeric ? 'decimal' : undefined}
              spellCheck={mono ? false : undefined}
              autoComplete="off"
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            {unit && <Small $muted>{unit}</Small>}
          </UnitRow>
          {trailing}
        </>
      )}
    </FormField>
  )
}

/* ---------- Switch ---------- */

export const SwitchField = ({
  id: givenId,
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  id?: string
  label: React.ReactNode
  help?: React.ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) => {
  const generated = useId()
  const id = givenId ?? generated
  return (
    <SwitchRow htmlFor={id}>
      <SwitchText>
        {label}
        {help && <Help>{help}</Help>}
      </SwitchText>
      {/* The app's lit Switch (a button), named by this label. */}
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(next) => onChange(next)}
      />
    </SwitchRow>
  )
}

/* ---------- Wallet and sign-in gate ---------- */

export interface WalletGate {
  /** The first blocker, if any: connect, switch chain, sign in. */
  blocker?: string
  /**
   * The action that clears the blocker, for a page's primary button: its
   * label names the action it unblocks ("Connect wallet to deploy").
   */
  fix?: { label: string; onClick: () => void; loading?: boolean }
  /** A small secondary control that clears the blocker, or null. */
  control: React.ReactNode
}

const signIn = (authoriseUser: () => Promise<unknown>) => {
  infoToast('Signing in...')
  authoriseUser()
    .then(() => successToast('Signed in successfully.'))
    .catch((err) => {
      console.error(err)
      errorToast(`Sign-in failed: ${err?.message ?? 'unknown error'}`)
    })
}

/**
 * Connect, then (for anything that writes on the URL chain) the chain
 * switch, then the Atlas sign-in uploads need. Each blocker names the
 * action it blocks: "Connect wallet to upload the logo".
 */
export const useWalletGate = ({
  verb,
  needsChain = false,
}: {
  verb: string
  needsChain?: boolean
}): WalletGate => {
  const { isConnected } = useAccount()
  const walletChainId = useChainId()
  const urlChainId = useUrlChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { isVerified, isSigningIn, authoriseUser } = useAtlasProvider()

  const chainName = urlChainId
    ? (NETWORKS_INFO[urlChainId as keyof typeof NETWORKS_INFO]?.name ??
      `chain ${urlChainId}`)
    : undefined
  const wrongChain =
    needsChain && isConnected && !!urlChainId && walletChainId !== urlChainId

  const connect = () => appKitModal?.open({ view: 'Connect' })
  const switchToUrlChain = () => {
    if (urlChainId) switchChain({ chainId: urlChainId })
  }
  const startSignIn = () => signIn(authoriseUser)

  if (!isConnected)
    return {
      blocker: `Connect wallet to ${verb}`,
      fix: { label: `Connect wallet to ${verb}`, onClick: connect },
      control: (
        <Button type="button" $variant="secondary" $size="sm" onClick={connect}>
          <CurateIcon name="wallet" size={14} />
          Connect wallet
        </Button>
      ),
    }
  if (wrongChain && urlChainId)
    return {
      blocker: `Switch to ${chainName} to ${verb}`,
      fix: {
        label: `Switch to ${chainName} to ${verb}`,
        onClick: switchToUrlChain,
        loading: switching,
      },
      control: (
        <Button
          type="button"
          $variant="secondary"
          $size="sm"
          disabled={switching}
          onClick={switchToUrlChain}
        >
          {switching ? 'Waiting…' : `Switch to ${chainName}`}
        </Button>
      ),
    }
  if (!isVerified)
    return {
      blocker: `Sign in to ${verb}`,
      fix: {
        label: `Sign in to ${verb}`,
        onClick: startSignIn,
        loading: isSigningIn,
      },
      control: (
        <Button
          type="button"
          $variant="secondary"
          $size="sm"
          disabled={isSigningIn}
          onClick={startSignIn}
        >
          {isSigningIn ? 'Waiting…' : 'Sign in'}
        </Button>
      ),
    }
  return { control: null }
}

/* ---------- IPFS upload through Atlas ---------- */

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])
const IMAGE_MAX_MB = 2
const PDF_MAX_MB = 4

/** The same acceptance rules the previous wizard enforced before uploading. */
const rejectUpload = (file: File, kind: 'image' | 'pdf'): string => {
  if (kind === 'image') {
    if (!IMAGE_TYPES.has(file.type)) return 'Please use PNG, webp, jpeg or SVG.'
    if (file.size / 1024 / 1024 >= IMAGE_MAX_MB)
      return `Image must be smaller than ${IMAGE_MAX_MB}MB.`
    return ''
  }
  if (file.type !== 'application/pdf') return 'Please upload file as PDF.'
  if (file.size / 1024 / 1024 >= PDF_MAX_MB)
    return `File must be smaller than ${PDF_MAX_MB}MB.`
  return ''
}

/** "/ipfs/Qm…/logo.png" → "Qm…/logo.png", for the mono line under an upload. */
const shortPath = (value: string): string => {
  const path = value.replace(/^\/?ipfs\//, '').replace(/^ipfs:\/\//, '')
  const [cid, ...rest] = path.split('/')
  const name = rest.join('/')
  return `${truncateMiddle(cid, 6, 4)}${name ? `/${name}` : ''}`
}

export const UploadField = ({
  id,
  label,
  help,
  kind,
  role,
  value,
  error,
  showError,
  what,
  previewAlt,
  onChange,
}: {
  id: string
  label: React.ReactNode
  help?: React.ReactNode
  kind: 'image' | 'pdf'
  role: Roles
  /** The IPFS URI already uploaded, or an empty string. */
  value: string
  error?: string
  showError?: boolean
  /** "the logo", "the policy": used in the blockers and the button. */
  what: string
  previewAlt?: string
  onChange: (uri: string) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [rejection, setRejection] = useState('')
  const { uploadFile } = useAtlasProvider()
  const gate = useWalletGate({ verb: `upload ${what}` })
  const invalid = !!showError && !!error
  const uri = value ? parseIpfs(value) : ''
  const noun = what.replace(/^the /, '')

  const pick = useCallback(
    async (file: File) => {
      const problem = rejectUpload(file, kind)
      setRejection(problem)
      if (problem) {
        toast.error(problem)
        return
      }
      setUploading(true)
      try {
        const fileURI = await uploadFile(file, role)
        if (!fileURI) throw new Error('Failed to upload file to IPFS.')
        onChange(fileURI)
        toast.success('File uploaded successfully.')
      } catch (err) {
        console.error(err)
        toast.error('File upload failed.')
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [kind, onChange, role, uploadFile],
  )

  return (
    <FormField
      id={id}
      label={label}
      help={help}
      error={error}
      showError={showError}
    >
      {(a11y) => (
        <>
          <UploadRow $empty={!uri} aria-invalid={invalid || undefined}>
            {kind === 'image' ? (
              <Thumb>
                <SafeImage
                  src={uri || undefined}
                  alt={previewAlt ?? 'Uploaded image'}
                  fallback={<CurateIcon name="registry" size={20} />}
                />
              </Thumb>
            ) : (
              <Thumb aria-hidden>
                <CurateIcon name="policy" size={20} />
              </Thumb>
            )}
            <UploadMeta>
              <strong>
                {uploading
                  ? 'Uploading to IPFS…'
                  : uri
                    ? kind === 'pdf'
                      ? 'Policy on IPFS'
                      : 'Logo on IPFS'
                    : `No ${noun} yet`}
              </strong>
              {uri ? (
                kind === 'pdf' ? (
                  <TextLink
                    href={uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={value}
                    aria-label={`Open the uploaded ${noun} (PDF)`}
                  >
                    <Data $mono style={{ color: 'inherit' }}>
                      {shortPath(value)}
                    </Data>
                  </TextLink>
                ) : (
                  <Data $mono $muted title={value}>
                    {shortPath(value)}
                  </Data>
                )
              ) : (
                <Small $faint>
                  {kind === 'image'
                    ? `PNG, SVG, WebP or JPEG · under ${IMAGE_MAX_MB} MB`
                    : `PDF · under ${PDF_MAX_MB} MB`}
                </Small>
              )}
            </UploadMeta>
            {gate.blocker ? (
              <Row $gap={8} $justify="flex-end">
                {gate.control}
              </Row>
            ) : (
              <Row $gap={6} $justify="flex-end" $wrap>
                {uri && (
                  <Button
                    type="button"
                    $variant="ghost"
                    $size="sm"
                    disabled={uploading}
                    onClick={() => {
                      setRejection('')
                      onChange('')
                    }}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  disabled={uploading}
                  aria-describedby={a11y['aria-describedby']}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading
                    ? 'Uploading…'
                    : uri
                      ? 'Replace'
                      : `Choose ${what}`}
                </Button>
              </Row>
            )}
            <HiddenInput
              ref={inputRef}
              id={a11y.id}
              type="file"
              accept={kind === 'image' ? [...IMAGE_TYPES].join(',') : '.pdf'}
              tabIndex={-1}
              aria-invalid={a11y['aria-invalid']}
              aria-describedby={a11y['aria-describedby']}
              onChange={(event) => {
                const picked = event.target.files?.[0]
                if (picked) pick(picked)
              }}
            />
          </UploadRow>
          {gate.blocker && (
            <Small $muted role="status">
              {gate.blocker}
            </Small>
          )}
          {uploading && (
            <Small $muted role="status">
              Uploading to IPFS…
            </Small>
          )}
          {rejection && <ErrorText role="alert">{rejection}</ErrorText>}
        </>
      )}
    </FormField>
  )
}
