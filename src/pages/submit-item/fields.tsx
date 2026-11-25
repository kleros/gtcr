import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { parseIpfs } from 'utils/ipfs-parse'
import { addPeriod } from 'utils/string'
import { normalizeDecimalInput } from 'utils/decimal-input'
import {
  parseRichAddress,
  references,
  type Reference,
} from 'utils/rich-address'
import { Button } from 'components/curate/primitives'
import {
  DROP_HINT,
  DROP_REPLACE,
  FileDropWell,
  useFileDrop,
} from 'components/file-drop'
import Select from 'components/ui/Select'
import Switch from 'components/ui/Switch'
import { formatFileSize } from './amounts'
import { allowedExtensions, extensionList, fileTypeProblem } from './file-types'
import {
  isEmptyField,
  isRequired,
  withWebScheme,
  type FieldValue,
} from './form'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { atlasUploadProblem } from 'utils/upload-restrictions'

/*
 * One field per registry column. A state mark in the left gutter (a faint
 * dot while empty; a darker dot once filled; a check only once a validated
 * column passed its check on blur; needs a fix), the label with "Optional" on the columns that are,
 * the control, the column's description as a quiet hint under it, and the
 * validation message inline. Values keep the shape the encoders expect
 * (strings; a File while an upload is stashed, resolved at submit time).
 */

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])
const IMAGE_MAX_MB = 2
const FILE_MAX_MB = 4
const chainKeyOf = (reference: Reference) =>
  `${reference.namespaceId}:${reference.id}`
const chainOptions = references.filter((reference) => !reference.deprecated)
const CHAIN_KEYS = references.map(chainKeyOf)
const DEFAULT_CHAIN_KEY = CHAIN_KEYS[0]

/**
 * The chain a stored rich address starts with ("eip155:100:…"), read by its
 * prefix rather than by parsing the whole value: text the parser cannot
 * split (a pasted "gno:0x…", a raw TON "0:…") still reads under the chain
 * that was picked. No two keys can both match: neither half holds a colon.
 */
const storedChainKey = (text: string): string | undefined =>
  CHAIN_KEYS.find((key) => text.startsWith(`${key}:`))

type FieldState = 'empty' | 'filled' | 'valid' | 'error'

/** Columns whose values are checked (format or upload rules), so a check means something. */
const VALIDATED_TYPES = new Set<string>([
  ItemTypes.ADDRESS,
  ItemTypes.GTCR_ADDRESS,
  ItemTypes.RICH_ADDRESS,
  ItemTypes.LINK,
  ItemTypes.IMAGE,
  ItemTypes.FILE,
])

const Shell = styled.div`
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 0 16px;
  min-width: 0;

  /* The field being edited lights its dot, with a halo like a status dot. */
  &:focus-within > span[data-state='empty']::after,
  &:focus-within > span[data-state='filled']::after {
    width: 8px;
    height: 8px;
    background: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-primary-soft);
  }

  @media (max-width: 520px) {
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 0 12px;
  }
`

const pop = keyframes`
  0% { transform: scale(0.6); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
`

const Mark = styled.span<{ $state: FieldState }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  color: transparent;
  transition:
    background var(--motion),
    border-color var(--motion),
    box-shadow var(--motion),
    color var(--motion);

  /*
   * Empty: a small faint dot, a bullet rather than an unanswered radio.
   * Filled, not (yet) validated: the dot grows and darkens, not a check.
   */
  ${({ $state }) =>
    ($state === 'empty' || $state === 'filled') &&
    css`
      &::after {
        content: '';
        width: ${$state === 'filled' ? 8 : 6}px;
        height: ${$state === 'filled' ? 8 : 6}px;
        border-radius: var(--radius-pill);
        background: ${$state === 'filled'
          ? 'var(--color-muted)'
          : 'var(--color-border-strong)'};
        transition:
          width var(--motion),
          height var(--motion),
          background var(--motion),
          box-shadow var(--motion);
      }
    `}

  ${({ $state }) =>
    $state === 'valid' &&
    css`
      background: var(--color-primary-fill);
      box-shadow: 0 0 12px
        color-mix(in srgb, var(--color-primary) 45%, transparent);
      color: var(--color-on-primary);
      animation: ${pop} 360ms cubic-bezier(0.34, 1.4, 0.64, 1);
    `}

  ${({ $state }) =>
    $state === 'error' &&
    css`
      border-color: var(--color-danger);
      background: var(--color-danger-soft);
      color: var(--color-danger);
    `}

  @media (max-width: 520px) {
    width: 18px;
    height: 18px;
    margin-top: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const MarkIcon = ({ state }: { state: FieldState }) =>
  state === 'error' ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 6v8M12 18h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`

const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
`

const FieldLabel = styled.label`
  color: var(--color-text);
  font-size: var(--fs-body-lg);
  line-height: 24px;
  font-weight: 500;
  letter-spacing: -0.01em;
`

const Optional = styled.span`
  flex: 0 0 auto;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Hint = styled.p`
  margin: 0;
  max-width: 72ch;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const slide = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
`

const ErrorText = styled.p`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  animation: ${slide} 220ms cubic-bezier(0.2, 0.8, 0.2, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const controlStyles = css`
  width: 100%;
  min-width: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-text);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  transition:
    border-color var(--motion),
    box-shadow var(--motion),
    background var(--motion);

  &::placeholder {
    color: var(--color-faint);
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
    opacity: 0.7;
  }

  /*
   * The global form reset paints text inputs and textareas with !important.
   * The doubled class outranks it, so every control here keeps one fill,
   * the focus ring and the invalid border.
   */
  && {
    border-color: var(--glass-border) !important;
    background: var(--color-raised) !important;
  }

  &&:hover:not(:disabled):not(:focus):not([aria-invalid='true']) {
    border-color: var(--color-border-strong) !important;
  }

  &&:focus {
    border-color: var(--color-primary) !important;
    box-shadow: 0 0 0 4px var(--color-primary-soft) !important;
  }

  &&[aria-invalid='true'] {
    border-color: var(--color-danger) !important;
  }

  &&[aria-invalid='true']:focus {
    box-shadow: 0 0 0 4px var(--color-danger-soft) !important;
  }
`

const Input = styled.input`
  ${controlStyles}
  height: 48px;
  padding: 0 16px;
`

const MonoInput = styled(Input)`
  font-family: var(--font-mono);
  font-size: var(--fs-body);
  font-variant-numeric: tabular-nums;
`

const TextArea = styled.textarea`
  ${controlStyles}
  min-height: 112px;
  padding: 13px 16px;
  font-family: inherit;
  resize: vertical;
`

/** Chain picker and address as one field, like a phone number's country code. */
const Joined = styled.div<{ $invalid?: boolean }>`
  display: grid;
  grid-template-columns: minmax(150px, 210px) minmax(0, 1fr);
  align-items: stretch;
  height: 48px;
  border: 1px solid
    ${({ $invalid }) =>
      $invalid ? 'var(--color-danger)' : 'var(--glass-border)'};
  border-radius: var(--radius);
  background: var(--color-raised);
  transition:
    border-color var(--motion),
    box-shadow var(--motion);

  &:hover {
    border-color: ${({ $invalid }) =>
      $invalid ? 'var(--color-danger)' : 'var(--color-border-strong)'};
  }

  &:focus-within {
    border-color: ${({ $invalid }) =>
      $invalid ? 'var(--color-danger)' : 'var(--color-primary)'};
    box-shadow: 0 0 0 4px
      ${({ $invalid }) =>
        $invalid ? 'var(--color-danger-soft)' : 'var(--color-primary-soft)'};
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`

/**
 * The address half of Joined: no fill, border or ring of its own (the
 * wrapper draws them), with the doubled class outranking the global reset.
 */
const JoinedInput = styled.input`
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0 16px;
  border: 0;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-variant-numeric: tabular-nums;

  &::placeholder {
    color: var(--color-faint);
  }

  &:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
    opacity: 0.7;
  }

  && {
    outline: none;
    border-radius: 0 var(--radius) var(--radius) 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  @media (max-width: 520px) {
    height: 46px;

    &&,
    &&:hover {
      border-top: 1px solid var(--glass-border) !important;
      border-radius: 0 0 var(--radius) var(--radius) !important;
    }
  }
`

/*
 * The chain half of Joined: the app's Select (glass listbox) with its own
 * field chrome removed, since the wrapper draws the border and the ring.
 */
const SelectWrap = styled.div`
  position: relative;
  min-width: 0;
  border-right: 1px solid var(--glass-border);

  .ui-select {
    display: block;
    width: 100%;
    height: 100%;
  }

  && .ui-select-trigger {
    height: 100%;
    min-height: 0;
    padding: 0 12px 0 16px;
    border: 0;
    border-radius: var(--radius) 0 0 var(--radius);
    background: transparent;
    box-shadow: none;
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
  }

  && .ui-select-trigger:disabled {
    color: var(--color-muted);
  }

  @media (max-width: 520px) {
    height: 46px;
    border-right: 0;

    && .ui-select-trigger {
      border-radius: var(--radius) var(--radius) 0 0;
    }
  }
`

const SwitchRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  cursor: pointer;
`

const Thumb = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--glass);
  color: var(--color-faint);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

/*
 * The file name and the hint wrap rather than run past the zone: in the
 * phones' column layout the text block spans the zone's width, and a name
 * with no spaces breaks where it must.
 */
const DropText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;

  span {
    color: var(--color-faint);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 520px) {
    align-self: stretch;
  }
`

const DropActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const FileLink = styled.a`
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const UploadGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 16V5m0 0l-4 4m4-4l4 4M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** An object URL for a stashed file, revoked when it changes. */
export const useObjectUrl = (file?: File): string => {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

/** Same acceptance rules as the input selector; the message replaces its toast. */
const rejectImage = (file: File): string => {
  if (!IMAGE_TYPES.has(file.type)) return 'Use a PNG, JPEG, WebP or SVG image.'
  if (file.size / 1024 / 1024 > IMAGE_MAX_MB)
    return `The image must be smaller than ${IMAGE_MAX_MB} MB.`
  return ''
}

const rejectFile = (file: File, allowed: string[]): string => {
  const typeProblem = fileTypeProblem(file, allowed)
  if (typeProblem) return typeProblem
  if (file.size / 1024 / 1024 > FILE_MAX_MB)
    return `The file must be smaller than ${FILE_MAX_MB} MB.`
  return ''
}

const UploadField = ({
  id,
  column,
  value,
  disabled,
  submitting,
  invalid,
  describedBy,
  onCommit,
  onBlur,
}: {
  id: string
  column: Column
  value: FieldValue | undefined
  disabled?: boolean
  submitting?: boolean
  invalid: boolean
  describedBy?: string
  onCommit: (value: FieldValue) => void
  onBlur: () => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rejection, setRejection] = useState('')
  // Atlas stores entry files under these roles and refuses other types.
  const { roleRestrictions } = useAtlasProvider()
  const isImage = column.type === ItemTypes.IMAGE
  const file = value instanceof File ? value : undefined
  const uri =
    !file && typeof value === 'string' && value ? parseIpfs(value) : ''
  const previewUrl = useObjectUrl(isImage ? file : undefined)
  const allowed = allowedExtensions(column.allowedFileTypes)
  const accept = isImage
    ? [...IMAGE_TYPES].join(',')
    : allowed.map((ext) => `.${ext}`).join(',') || undefined
  // What the app can upload; a list's policy can ask for less (one format,
  // a smaller file), and its column help says so.
  const hint = isImage
    ? `PNG, JPEG, WebP or SVG, up to ${IMAGE_MAX_MB} MB · the list's policy may ask for less`
    : allowed.length > 0
      ? `${extensionList(allowed)}, up to ${FILE_MAX_MB} MB`
      : `Up to ${FILE_MAX_MB} MB`
  const hasValue = !!file || !!uri
  const image = isImage ? previewUrl || uri : ''

  const pick = (picked: File) => {
    const problem =
      (isImage ? rejectImage(picked) : rejectFile(picked, allowed)) ||
      atlasUploadProblem(
        picked,
        isImage ? Roles.CurateItemImage : Roles.CurateItemFile,
        roleRestrictions,
      )
    setRejection(problem)
    if (problem) onBlur()
    else onCommit(picked)
  }

  const clear = () => {
    setRejection('')
    onCommit('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // A dropped file takes the same two steps a refused pick does: the field
  // is marked touched and the message shows under it.
  const drop = useFileDrop<HTMLDivElement>({
    // Why, not just that: the entry is on its way, or this column is fixed
    // for this flow and cannot be changed here.
    blocked: submitting
      ? 'The entry is being sent.'
      : disabled
        ? 'This column cannot be changed here.'
        : '',
    onFile: pick,
    onRefuse: (problem) => {
      setRejection(problem)
      onBlur()
    },
  })

  return (
    <>
      <FileDropWell
        $invalid={invalid || !!rejection}
        $over={drop.over}
        $refusing={!!drop.refusal}
        $disabled={disabled}
        {...drop.handlers}
      >
        <Thumb>
          {image ? (
            <img src={image} alt={`${column.label} preview`} />
          ) : (
            <UploadGlyph />
          )}
        </Thumb>
        <DropText>
          {drop.over ? (
            <>
              {drop.refusal || (hasValue ? DROP_REPLACE : DROP_HINT)}
              <span>{hint}</span>
            </>
          ) : file ? (
            <>
              {file.name}
              <span>{formatFileSize(file.size)} · uploads when you submit</span>
            </>
          ) : uri ? (
            <>
              <FileLink href={uri} target="_blank" rel="noopener noreferrer">
                Open the uploaded file
              </FileLink>
              <span>{hint}</span>
            </>
          ) : (
            <>
              Drop a file here or choose one
              <span>{hint}</span>
            </>
          )}
        </DropText>
        {/* The label, hint and error point at the hidden input, which the
            keyboard skips: the buttons name the column and carry them. */}
        <DropActions>
          <Button
            type="button"
            $variant="secondary"
            $size="sm"
            disabled={disabled}
            aria-label={
              hasValue
                ? `Replace the file for ${column.label}`
                : `Choose a file for ${column.label}`
            }
            aria-describedby={describedBy}
            onClick={() => inputRef.current?.click()}
          >
            {hasValue ? 'Replace' : 'Choose a file'}
          </Button>
          {hasValue && (
            <Button
              type="button"
              $variant="ghost"
              $size="sm"
              disabled={disabled}
              aria-label={`Remove the file for ${column.label}`}
              aria-describedby={describedBy}
              onClick={clear}
            >
              Remove
            </Button>
          )}
        </DropActions>
        <HiddenInput
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          tabIndex={-1}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            const picked = event.target.files?.[0]
            event.target.value = ''
            if (picked) pick(picked)
          }}
        />
      </FileDropWell>
      {rejection && (
        <ErrorText role="alert">
          <MarkIcon state="error" />
          {rejection}
        </ErrorText>
      )}
    </>
  )
}

/**
 * Chain picker and address as one field. The stored value is
 * "<chain>:<address>", built from the picked chain and the typed text, and
 * the chain is read back by its prefix: text the parser cannot split stays
 * in the box under the chain that was picked, and validation calls it
 * invalid, instead of the box emptying and the chain going back to Ethereum.
 */
const RichAddressField = ({
  column,
  text,
  invalid,
  disabled,
  inputProps,
  onChange,
  onBlur,
}: {
  column: Column
  text: string
  invalid: boolean
  disabled?: boolean
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
  onChange: (value: FieldValue) => void
  onBlur: () => void
}) => {
  const pickerRef = useRef<HTMLDivElement>(null)
  const chainKey = storedChainKey(text) ?? DEFAULT_CHAIN_KEY
  const address = text.startsWith(`${chainKey}:`)
    ? text.slice(chainKey.length + 1)
    : ''
  return (
    <Joined $invalid={invalid}>
      {/* The picker's panel, with its search box, is portalled to <body>:
          focus moving into it or back to the trigger has not left the
          picker, so only a blur to anywhere else marks the field. */}
      <SelectWrap
        ref={pickerRef}
        onBlur={(event) => {
          const next = event.relatedTarget
          if (
            next instanceof Element &&
            (event.currentTarget.contains(next) ||
              next.closest('.ui-select-dropdown'))
          )
            return
          onBlur()
        }}
      >
        <Select
          aria-label={`${column.label} chain`}
          value={chainKey}
          disabled={disabled}
          showSearch
          dropdownStyle={{ minWidth: 220 }}
          onChange={(next) => {
            onChange(`${typeof next === 'object' ? next.key : next}:${address}`)
            // The search box had focus and closes with the panel: focus goes
            // back to the picker, where it stays without a search box.
            pickerRef.current
              ?.querySelector<HTMLElement>('.ui-select-trigger')
              ?.focus()
          }}
        >
          {chainOptions.map((reference) => (
            <Select.Option
              key={chainKeyOf(reference)}
              value={chainKeyOf(reference)}
            >
              {reference.name}
            </Select.Option>
          ))}
        </Select>
      </SelectWrap>
      <JoinedInput
        {...inputProps}
        type="text"
        value={address}
        placeholder="Address"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="none"
        onChange={(event) => {
          const typed = event.target.value.trim()
          // A full CAIP-10 address ("eip155:100:0x…") on a chain the picker
          // offers sets both halves.
          const full = parseRichAddress(typed)
          onChange(
            full && chainOptions.includes(full.reference)
              ? typed
              : `${chainKey}:${typed}`,
          )
        }}
      />
    </Joined>
  )
}

export interface ColumnFieldProps {
  column: Column
  value: FieldValue | undefined
  error?: string
  /** Errors show once the field was touched (or the form was submitted). */
  showError: boolean
  disabled?: boolean
  /**
   * The entry is being sent. It is part of `disabled`; apart from it, an
   * upload can say which of the two blockers is holding a dropped file.
   */
  submitting?: boolean
  onChange: (value: FieldValue) => void
  onBlur: () => void
  /**
   * A value set in one step (a picked or removed file): marks the field
   * touched and validates the new value, not the one before it.
   */
  onCommit: (value: FieldValue) => void
}

export const ColumnField = ({
  column,
  value,
  error,
  showError,
  disabled,
  submitting,
  onChange,
  onBlur,
  onCommit,
}: ColumnFieldProps) => {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const required = isRequired(column)
  const description = column.description ? addPeriod(column.description) : ''
  const invalid = showError && !!error
  const describedBy =
    [invalid ? errorId : '', description ? helpId : '']
      .filter(Boolean)
      .join(' ') || undefined
  const text = typeof value === 'string' ? value : ''
  const { type } = column
  const isBoolean = type === ItemTypes.BOOLEAN
  const filled = isBoolean || !isEmptyField(column, value)
  const state: FieldState = invalid
    ? 'error'
    : !filled
      ? 'empty'
      : showError && !error && VALIDATED_TYPES.has(type)
        ? 'valid'
        : 'filled'

  const shared = {
    id,
    disabled,
    onBlur,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
  }

  let control: React.ReactNode
  if (isBoolean)
    control = (
      // The app's lit Switch (a button). The row's onBlur marks the field
      // touched when focus leaves it, as the checkbox's own onBlur did.
      <SwitchRow htmlFor={id} onBlur={onBlur}>
        <span aria-hidden>{text === 'true' ? 'Yes' : 'No'}</span>
        <Switch
          id={id}
          disabled={disabled}
          aria-invalid={shared['aria-invalid']}
          aria-describedby={describedBy}
          checked={text === 'true'}
          onChange={(checked) => onChange(String(checked))}
        />
      </SwitchRow>
    )
  else if (type === ItemTypes.LONG_TEXT)
    control = (
      <TextArea
        {...shared}
        rows={4}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  else if (type === ItemTypes.ADDRESS || type === ItemTypes.GTCR_ADDRESS)
    control = (
      <MonoInput
        {...shared}
        type="text"
        value={text}
        placeholder="0x…"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="none"
        onChange={(event) => onChange(event.target.value.trim())}
      />
    )
  else if (type === ItemTypes.RICH_ADDRESS)
    control = (
      <RichAddressField
        column={column}
        text={text}
        invalid={invalid}
        disabled={disabled}
        inputProps={shared}
        onChange={onChange}
        onBlur={onBlur}
      />
    )
  else if (type === ItemTypes.IMAGE || type === ItemTypes.FILE)
    control = (
      <UploadField
        id={id}
        column={column}
        value={value}
        disabled={disabled}
        submitting={submitting}
        invalid={invalid}
        describedBy={describedBy}
        onCommit={onCommit}
        onBlur={onBlur}
      />
    )
  else {
    const numeric =
      type === ItemTypes.NUMBER || type === ItemTypes.TWITTER_USER_ID
    const isLink = type === ItemTypes.LINK
    control = (
      <Input
        {...shared}
        type={isLink ? 'url' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        placeholder={isLink ? 'https://' : undefined}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          // "example.org" becomes "https://example.org", and a decimal typed
          // with a comma ("0,5", from a keypad with no dot) reads "0.5"; then
          // it validates.
          const next = isLink
            ? withWebScheme(text)
            : type === ItemTypes.NUMBER
              ? normalizeDecimalInput(text)
              : text
          if (next !== text) onCommit(next)
          else onBlur()
        }}
      />
    )
  }

  return (
    <Shell>
      <Mark $state={state} data-state={state} aria-hidden>
        {(state === 'valid' || state === 'error') && <MarkIcon state={state} />}
      </Mark>
      <Body>
        <LabelRow>
          <FieldLabel htmlFor={id}>{column.label}</FieldLabel>
          {!required && !isBoolean && <Optional>Optional</Optional>}
        </LabelRow>
        {control}
        {invalid && (
          <ErrorText id={errorId}>
            <MarkIcon state="error" />
            {error}
          </ErrorText>
        )}
        {description && <Hint id={helpId}>{description}</Hint>}
      </Body>
    </Shell>
  )
}

export default ColumnField
