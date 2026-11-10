import React, { useId, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { useField } from 'formik'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useAtlasProvider } from '@kleros/kleros-app'
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
 * The Stake wizard's controls: a labelled field with one line of help and
 * the validation message inline, text and amount inputs, a select (the
 * app's glass Select), a lit range slider, a switch (the app's lit Switch),
 * the wallet gate (connect, switch chain, sign in) and the IPFS upload
 * through Atlas. Formik binds through `useField`, so the steps keep their
 * `withFormik` wrappers and schemas.
 */

/* ---------- Layout ---------- */

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

/**
 * Two columns from 720px up. `$alignEnd` lines the inputs up on one row
 * when the help above them wraps to different heights.
 */
export const FieldGrid = styled.div<{ $columns?: 2 | 3; $alignEnd?: boolean }>`
  display: grid;
  grid-template-columns: repeat(
    ${({ $columns }) => $columns ?? 2},
    minmax(0, 1fr)
  );
  align-items: ${({ $alignEnd }) => ($alignEnd ? 'end' : 'start')};
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

/** A quiet raised block inside a step (no border, no nested panel). */
export const Note = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--color-raised);
`

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

/** Hairline between groups of fields, with an optional small label. */
export const Divider = ({ label }: { label?: React.ReactNode }) => (
  <DividerShell role="separator">
    {label && <Label $tone="faint">{label}</Label>}
  </DividerShell>
)

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
  heading,
  lede,
}: {
  heading: string
  lede?: React.ReactNode
}) => (
  <HeaderShell>
    <StepTitle>{heading}</StepTitle>
    {lede && <StepLede>{lede}</StepLede>}
  </HeaderShell>
)

/* ---------- Text ---------- */

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

export const TextLink = styled.a`
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

/** Text for screen readers only. */
export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/**
 * An image from IPFS rendered as <img> (never interpolated into CSS); if it
 * fails to load, the fallback shows instead.
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

/* ---------- Inputs ---------- */

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

/** The number box beside a slider: right-aligned figures. */
export const AmountInput = styled(Input)`
  flex: 0 0 auto;
  width: 104px;
  text-align: right;
  font-family: var(--font-figure);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
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

/** Range slider: the track lights up to the thumb. */
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

/** The two ends of a slider, under it, clear of the number box. */
export const SliderEnds = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-right: 164px;

  @media (max-width: 520px) {
    padding-right: 0;
  }
`

/* ---------- Field wrapper ---------- */

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

export interface FieldA11y {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

/**
 * Label, help, control and error wired together with ids, so screen readers
 * announce the help and the error with the control.
 */
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

const UnitRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  ${Input} {
    flex: 1;
  }
`

const Unit = styled.span`
  flex: 0 0 auto;
  min-width: 32px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: nowrap;
`

/** A Formik-bound text field, with an optional unit after the input. */
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
  unit?: React.ReactNode
  mono?: boolean
  numeric?: boolean
  /** Extra content under the input. */
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
              autoCapitalize={mono ? 'none' : undefined}
              autoComplete="off"
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            {unit && <Unit>{unit}</Unit>}
          </UnitRow>
          {trailing}
        </>
      )}
    </FormField>
  )
}

/* ---------- Switch ---------- */

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

/** The app's lit Switch; a field names it with a label or `aria-label`. */
export const Toggle = Switch

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
 * Connect, then (for anything written on the URL chain) the chain switch,
 * then the Atlas sign-in. Each blocker names the action it blocks:
 * "Connect wallet to deploy", "Switch to Gnosis to deploy", "Sign in to deploy".
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

/* ---------- Upload ---------- */

const UploadRow = styled.div<{ $empty: boolean }>`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px;
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

/** "/ipfs/Qm…/logo.png" → "Qm…/logo.png", for the mono line under an upload. */
const shortPath = (value: string): string => {
  const path = value.replace(/^\/?ipfs\//, '').replace(/^ipfs:\/\//, '')
  const [cid, ...rest] = path.split('/')
  const name = rest.join('/')
  return `${truncateMiddle(cid, 6, 4)}${name ? `/${name}` : ''}`
}

/**
 * One upload: the current file as a thumbnail or a link, its IPFS path, the
 * acceptance rule, and a button that opens the file picker behind the
 * wallet and Atlas sign-in gate (uploads go through Atlas).
 */
export const UploadField = ({
  id,
  label,
  help,
  hint,
  kind,
  accept,
  value,
  uploading,
  error,
  showError,
  what,
  reject,
  onPick,
}: {
  id: string
  label: React.ReactNode
  help?: React.ReactNode
  /** The acceptance rule ("PNG, SVG, WebP or JPEG · under 2 MB"). */
  hint: string
  kind: 'image' | 'pdf'
  accept: string
  /** The IPFS path once uploaded, or an empty string. */
  value: string
  uploading: boolean
  error?: string
  showError?: boolean
  /** "the logo", "the policy": used in the blocker and the button. */
  what: string
  /** The problem with a picked file, or '' when it is acceptable. */
  reject: (file: File) => string
  onPick: (file: File) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rejection, setRejection] = useState('')
  const gate = useWalletGate({ verb: `upload ${what}` })
  const invalid = !!showError && !!error
  const uri = value ? parseIpfs(value) : ''
  const noun = what.replace(/^the /, '')

  const pick = (file: File) => {
    const problem = reject(file)
    setRejection(problem)
    if (!problem) onPick(file)
  }

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
            <Thumb aria-hidden={kind === 'pdf' || undefined}>
              {kind === 'image' ? (
                <SafeImage
                  src={uri || undefined}
                  alt="List logo"
                  fallback={<CurateIcon name="registry" size={20} />}
                />
              ) : (
                <CurateIcon name="policy" size={20} />
              )}
            </Thumb>
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
                <TextLink
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={value}
                  aria-label={
                    kind === 'image'
                      ? 'Open the uploaded logo'
                      : 'Open the uploaded PDF'
                  }
                >
                  <Data $mono style={{ color: 'inherit' }}>
                    {shortPath(value)}
                  </Data>
                </TextLink>
              ) : (
                <Small $faint>{hint}</Small>
              )}
            </UploadMeta>
            <Row $gap={8} $justify="flex-end">
              {gate.blocker ? (
                gate.control
              ) : (
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
              )}
            </Row>
            <HiddenInput
              ref={inputRef}
              id={a11y.id}
              type="file"
              accept={accept}
              disabled={uploading || !!gate.blocker}
              tabIndex={-1}
              aria-invalid={a11y['aria-invalid']}
              aria-describedby={a11y['aria-describedby']}
              onChange={(event) => {
                const picked = event.target.files?.[0]
                if (picked) pick(picked)
                event.target.value = ''
              }}
            />
          </UploadRow>
          {gate.blocker && (
            <Small $muted role="status">
              {gate.blocker}
            </Small>
          )}
          {rejection && <ErrorText role="alert">{rejection}</ErrorText>}
        </>
      )}
    </FormField>
  )
}
