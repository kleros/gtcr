import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { withFormik, Field, type FormikProps, type FieldProps } from 'formik'
import * as yup from 'yup'
import {
  Button,
  Data,
  IconButton,
  Small,
  Stack,
  TextInput,
  VisuallyHidden,
} from 'components/curate/primitives'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { CurateIcon } from 'components/curate/icons'
import {
  atlasLimit,
  atlasUploadProblem,
  formatLimit,
} from 'utils/upload-restrictions'
import { FieldError, FieldLabel } from 'components/curate/item-standard-notice'
import {
  DROP_HINT,
  DROP_REPLACE,
  FileDropVeil,
  FileDropWell,
  useFileDrop,
} from 'components/file-drop'
import {
  edgeTransition,
  flatFill,
  litEdgeBackground,
} from 'components/ui/kit-styles'
import EvidenceText from 'components/curate/evidence-text'
import { TimelineQuote } from 'components/curate/item-standard-timeline'

/*
 * Evidence form (ERC-1497): a title (when detailed), a description and an
 * optional attachment. The file is stashed in form state and uploaded only
 * at submit time, after the Atlas sign-in gate, so the upload never races
 * the sign-in flow.
 *
 * Two layouts. "fields" (dialogs) labels each field. "composer" (an entry
 * page's evidence section) is one message box: the title on top, a hairline,
 * the description growing with its text, and a toolbar along the bottom
 * edge with the attachment on the left and the caller's action on the right.
 *
 * The description is written in Markdown, and "Preview" shows it as the
 * history will, with the history's own component: what is sent cannot be
 * changed. The field stays in the page while the preview shows (its undo
 * history, its height), out of sight.
 */

// Used until Atlas has said what evidence attachments it takes.
const MAX_FILE_MB = 4

// The description's limit, and the length from which its count shows.
const DESCRIPTION_MAX = 1024
const COUNT_FROM = 900

const integer = new Intl.NumberFormat('en-US')

const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

/* Out of sight while the preview shows; the global form styles paint
   textareas with !important. */
const hiddenWhilePreviewing = css<{ $hidden?: boolean }>`
  ${({ $hidden }) => $hidden && 'display: none !important;'}
`

const Textarea = styled.textarea<{ $hidden?: boolean }>`
  width: 100%;
  min-height: 120px;
  padding: 12px 14px;
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--radius);
  background: var(--color-raised) !important;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: 22px;
  resize: vertical;
  transition:
    border-color var(--motion),
    box-shadow var(--motion);

  &::placeholder {
    color: var(--color-faint);
  }

  &:hover {
    border-color: var(--color-border-strong) !important;
  }

  &:focus {
    outline: none;
    border-color: var(--color-primary) !important;
    box-shadow: 0 0 0 4px var(--color-primary-soft) !important;
  }

  ${hiddenWhilePreviewing}
`

const Preview = styled.img`
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--color-surface);
`

const FileIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--color-muted);
`

const FileMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;

  @media (max-width: 520px) {
    align-self: stretch;
  }
`

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`

const PickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
`

/** After a required field's label: quieter, in sentence case. */
const Required = styled.span`
  color: var(--color-faint);
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
`

/* The description's length once it nears the limit, in the danger colour
   past it. The auto margin keeps it at the end of its row or column. */
const Count = styled.span<{ $over: boolean }>`
  margin-left: auto;
  color: ${({ $over }) =>
    $over ? 'var(--color-danger)' : 'var(--color-muted)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

/* ---------- Composer layout ---------- */

const HiddenLabel = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`

/* One box for the whole message. Its ring is the focus indicator for the
   two text fields inside it, which draw none of their own. */
const Box = styled.div<{
  $invalid: boolean
  $over?: boolean
  $refusing?: boolean
}>`
  --edge-angle: 210deg;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid
    ${({ $invalid }) =>
      $invalid
        ? 'color-mix(in srgb, var(--color-danger) 55%, transparent)'
        : 'var(--glass-border)'};
  border-radius: var(--radius-well);
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition:
    border-color var(--motion),
    box-shadow var(--motion),
    ${edgeTransition};

  &:hover {
    border-color: var(--color-border-strong);
  }

  &:has(input:focus-visible, textarea:focus-visible) {
    border-color: var(--color-primary);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      0 0 0 4px var(--color-primary-soft);
  }

  @supports not selector(:has(*)) {
    &:focus-within {
      border-color: var(--color-primary);
      box-shadow:
        inset 0 1px 0 var(--glass-highlight),
        0 0 0 4px var(--color-primary-soft);
    }
  }

  ${({ $refusing }) =>
    $refusing &&
    css`
      &&& {
        border-color: var(--color-danger);
        background: var(--color-danger-soft);
        box-shadow: inset 0 1px 0 var(--glass-highlight);
      }
    `}

  ${({ $over, $refusing }) =>
    $over &&
    !$refusing &&
    css`
      &&& {
        --edge-angle: 570deg;
        border-color: transparent;
        background: ${litEdgeBackground(
          flatFill(
            'color-mix(in srgb, var(--color-primary) 6%, var(--color-raised))',
          ),
        )};
        box-shadow:
          inset 0 1px 0 var(--glass-highlight),
          0 0 0 4px color-mix(in srgb, var(--edge-2) 12%, transparent);
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const bare = css`
  display: block;
  width: 100%;
  margin: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-sans);

  &::placeholder {
    color: var(--color-faint);
  }

  &:focus,
  &:focus-visible {
    outline: none;
  }
`

const TitleField = styled.input`
  ${bare}
  height: 48px;
  padding: 0 16px;
  font-size: var(--fs-body-lg);
  font-weight: 500;
  letter-spacing: -0.005em;
`

const Rule = styled.span`
  display: block;
  height: 1px;
  margin: 0 16px;
  background: var(--glass-border);
`

/* Three lines at rest; it grows with the text up to about twelve. The
   global form styles paint every textarea; this one belongs to the box. */
const BodyField = styled.textarea<{ $hidden?: boolean }>`
  ${bare}
  border: 0 !important;
  border-radius: 0 0 var(--radius-well) var(--radius-well) !important;
  background: transparent !important;
  box-shadow: none !important;
  min-height: 84px;
  max-height: 300px;
  padding: 12px 16px;
  font-size: var(--fs-body);
  line-height: 22px;
  resize: none;
  overflow-y: auto;

  ${hiddenWhilePreviewing}
`

/* The description as the history shows it, where the field was: as tall at
   rest, and scrolling past the same height. */
const ComposerPreview = styled.div`
  min-height: 84px;
  max-height: 300px;
  overflow-y: auto;
  padding: 6px 16px 12px;
`

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 8px 8px 10px;

  @media (max-width: 560px) {
    > :last-child {
      flex: 1 1 100%;
    }

    > :last-child > * {
      flex: 1 1 auto;
    }
  }
`

const Attach = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: var(--fs-small);
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover:not(:disabled) {
    background: var(--color-surface);
    color: var(--color-text);
  }

  &:disabled {
    color: var(--color-faint);
    cursor: not-allowed;
  }

  span {
    color: var(--color-muted);
  }
`

const FileChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  height: 34px;
  padding: 0 4px 0 6px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);

  img,
  > svg {
    flex: 0 0 auto;
  }

  img {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    object-fit: cover;
  }

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-small);
  }

  small {
    flex: 0 0 auto;
    color: var(--color-muted);
    font-size: var(--fs-small);
  }

  button {
    width: 26px;
    height: 26px;
    flex: 0 0 auto;
  }

  button:disabled,
  button:disabled:hover {
    background: transparent;
    color: var(--color-faint);
    cursor: not-allowed;
  }
`

const ToolbarEnd = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
`

/* The attachment and the preview, together on the left. */
const ToolbarStart = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-width: 0;
`

/* A toggle (aria-pressed): its name stays "Preview", its tint says it is on.
   The fills read on any surface: the composer's raised box and a dialog,
   whose own background is the surface colour. */
const PreviewToggle = styled(Attach)`
  &:hover:not(:disabled) {
    background: var(--hover-fill);
  }

  &[aria-pressed='true'],
  &[aria-pressed='true']:hover {
    background: var(--color-primary-soft);
    color: var(--color-primary-on-soft);
  }
`

/* In the dialogs, beside the description's label, on the label's line. */
const LabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  ${PreviewToggle} {
    height: 28px;
    margin: -4px 0;
    padding: 0 8px;
  }
`

const FieldPreview = styled.div`
  min-height: 120px;
  padding: 6px 14px 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
`

const Errors = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 2px 0;
`

const PaperclipIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="m20.5 11.5-8.2 8.2a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" />
  </svg>
)

const EyeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
)

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Fit a textarea to its text, within its CSS min and max heights. */
const fitHeight = (element: HTMLTextAreaElement | null) => {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight + 2}px`
}

export interface EvidenceFormValues {
  title?: string
  description?: string
  evidenceAttachment?: File
  [key: string]: unknown
}

interface EvidenceFormOuterProps {
  formID: string
  detailed?: boolean
  onSubmit: (values: EvidenceFormValues) => void | Promise<unknown>
  /** "fields" (labelled, for dialogs) or "composer" (one message box). */
  variant?: 'fields' | 'composer'
  /** The composer's action, on the right of its toolbar. */
  actions?: React.ReactNode
  /** Told whenever the form goes from empty to drafted and back. */
  onDraftChange?: (drafted: boolean) => void
  /**
   * While true the composer never submits, Enter in the title included: the
   * wallet step the toolbar button names comes first.
   */
  blocked?: boolean
  /**
   * While true the attachment cannot be changed: a piece is being sent and
   * its files are already going up. A send made through this form is known
   * without it (formik's own flag, below), so this is for a caller whose
   * piece goes out some other way.
   */
  busy?: boolean
}

type EvidenceFormProps = EvidenceFormOuterProps &
  FormikProps<EvidenceFormValues>

const EvidenceForm = ({
  formID,
  detailed,
  variant = 'fields',
  actions,
  onDraftChange,
  blocked,
  busy,
  handleSubmit,
  setFieldValue,
  values,
  errors,
  submitCount,
  isSubmitting,
}: EvidenceFormProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Attachments are stored by Atlas as evidence: its own limits, once known.
  const { roleRestrictions } = useAtlasProvider()
  const evidenceLimit = atlasLimit(Roles.Evidence, roleRestrictions)
  const sizeLabel = evidenceLimit
    ? formatLimit(evidenceLimit.maxSize)
    : `${MAX_FILE_MB} MB`
  const errorsId = useId()
  const countId = useId()
  const file = values.evidenceAttachment as File | undefined
  const drafted = !!(values.title || values.description || file)
  /*
   * The attachment is frozen while the piece goes out, however it was
   * started: the caller may say so (the composer, which knows its phase),
   * and a submit through this form says so by itself, so a dialog shows the
   * file that is being uploaded rather than a newer one dropped over it.
   */
  const sending = !!busy || isSubmitting

  const description = values.description ?? ''
  const hasText = description.trim() !== ''
  const [previewing, setPreviewing] = useState(false)
  const showPreview = previewing && hasText
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const backToWriting = useRef(false)
  // An emptied field (a piece just sent) is written in again, not previewed.
  useEffect(() => {
    if (!hasText) setPreviewing(false)
  }, [hasText])
  // A send refused for the text itself (too long) shows the text again,
  // where its error points.
  const descriptionError = errors.description
  useEffect(() => {
    if (submitCount > 0 && descriptionError) setPreviewing(false)
  }, [submitCount, descriptionError])
  // Leaving the preview puts the caret back in the text, once it shows.
  useEffect(() => {
    if (showPreview || !backToWriting.current) return
    backToWriting.current = false
    descriptionRef.current?.focus()
  }, [showPreview])
  const togglePreview = () => {
    backToWriting.current = showPreview
    setPreviewing(!showPreview)
  }
  const previewToggle = (
    <PreviewToggle
      type="button"
      aria-pressed={showPreview}
      disabled={!hasText}
      onClick={togglePreview}
    >
      <EyeIcon />
      Preview
    </PreviewToggle>
  )
  const preview = showPreview && (
    <TimelineQuote role="group" aria-label="Preview of the description">
      <EvidenceText text={description} />
    </TimelineQuote>
  )

  // The limit is said while typing, not only once submit is pressed.
  const length = values.description?.length ?? 0
  const counting = length > COUNT_FROM
  const count = counting ? (
    <Count id={countId} $over={length > DESCRIPTION_MAX}>
      {integer.format(length)} / {integer.format(DESCRIPTION_MAX)}
      <VisuallyHidden> characters</VisuallyHidden>
    </Count>
  ) : null

  useEffect(() => {
    onDraftChange?.(drafted)
  }, [drafted, onDraftChange])

  // Defer the actual IPFS upload to submit time. The parent's confirm button
  // is the EnsureAuth/SIWE gate; if we uploaded here the request would race
  // the sign-in flow and fail before the user is verified.
  const pick = useCallback(
    (picked: File) => {
      const problem = evidenceLimit
        ? atlasUploadProblem(picked, Roles.Evidence, roleRestrictions)
        : picked.size / 1024 / 1024 >= MAX_FILE_MB
          ? `File must be smaller than ${MAX_FILE_MB}MB.`
          : ''
      if (problem) {
        setFileError(problem)
        return
      }
      setFileError(null)
      setFieldValue('evidenceAttachment', picked)
    },
    [setFieldValue, evidenceLimit, roleRestrictions],
  )

  const onPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (picked) pick(picked)
    },
    [pick],
  )

  // A dropped file takes the same path as a chosen one, and a refusal lands
  // in the same message under the form.
  const drop = useFileDrop<HTMLDivElement>({
    blocked: sending ? 'This piece is being sent.' : '',
    onFile: pick,
    onRefuse: setFileError,
  })

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const fileInput = (
    <HiddenInput
      ref={inputRef}
      id={`${formID}-file`}
      type="file"
      tabIndex={-1}
      aria-label="Attach a file"
      accept={evidenceLimit?.allowedMimeTypes.join(',')}
      onChange={onPick}
    />
  )

  if (variant === 'composer') {
    // Errors show once a submit was tried, so an untouched box stays calm.
    const shown = [
      submitCount > 0 && detailed ? errors.title : undefined,
      submitCount > 0 ? errors.description : undefined,
      fileError,
    ].filter((message): message is string => !!message)

    // With no submit button in the toolbar (the wallet step's button stands
    // in), Enter in the title would still submit the form implicitly.
    const onFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      if (blocked) {
        event.preventDefault()
        return
      }
      handleSubmit(event)
    }

    return (
      <form id={formID} onSubmit={onFormSubmit} noValidate>
        <Box
          $invalid={shown.length > 0}
          $over={drop.over}
          $refusing={!!drop.refusal}
          {...drop.handlers}
        >
          {detailed && (
            <Field name="title">
              {({
                field,
              }: FieldProps<string | undefined, EvidenceFormValues>) => (
                <>
                  <HiddenLabel htmlFor={`${formID}-title`}>Title</HiddenLabel>
                  <TitleField
                    id={`${formID}-title`}
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Title"
                    maxLength={255}
                    autoComplete="off"
                    aria-required
                    aria-invalid={submitCount > 0 && !!errors.title}
                    aria-describedby={shown.length > 0 ? errorsId : undefined}
                  />
                  <Rule aria-hidden />
                </>
              )}
            </Field>
          )}
          <Field name="description">
            {({
              field,
            }: FieldProps<string | undefined, EvidenceFormValues>) => (
              <>
                <HiddenLabel htmlFor={`${formID}-description`}>
                  Description
                </HiddenLabel>
                <BodyField
                  id={`${formID}-description`}
                  ref={descriptionRef}
                  $hidden={showPreview}
                  {...field}
                  value={field.value ?? ''}
                  onChange={(event) => {
                    field.onChange(event)
                    fitHeight(event.currentTarget)
                  }}
                  rows={3}
                  placeholder="What should the jurors know? Point to the listing policy. Markdown works."
                  aria-required
                  aria-invalid={submitCount > 0 && !!errors.description}
                  aria-describedby={
                    [counting && countId, shown.length > 0 && errorsId]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                />
                {preview && <ComposerPreview>{preview}</ComposerPreview>}
              </>
            )}
          </Field>
          <Toolbar>
            <ToolbarStart>
              {file ? (
                <FileChip title={file.name}>
                  {previewUrl && file.type.includes('image') ? (
                    <img src={previewUrl} alt="" />
                  ) : (
                    <PaperclipIcon />
                  )}
                  <span>{file.name}</span>
                  <small>{formatSize(file.size)}</small>
                  <IconButton
                    type="button"
                    disabled={sending}
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFieldValue('evidenceAttachment', undefined)
                    }
                  >
                    <CurateIcon name="close" size={12} />
                  </IconButton>
                </FileChip>
              ) : (
                <Attach
                  type="button"
                  disabled={sending}
                  onClick={() => inputRef.current?.click()}
                >
                  <PaperclipIcon />
                  Attach a file
                  <span>
                    <span aria-hidden>· </span>up to {sizeLabel}
                  </span>
                </Attach>
              )}
              {previewToggle}
            </ToolbarStart>
            {count}
            {actions && <ToolbarEnd>{actions}</ToolbarEnd>}
          </Toolbar>
          {fileInput}
          {drop.over && (
            <FileDropVeil $refusing={!!drop.refusal}>
              <PaperclipIcon />
              {drop.refusal || (file ? DROP_REPLACE : DROP_HINT)}
            </FileDropVeil>
          )}
        </Box>
        {shown.length > 0 && (
          <Errors id={errorsId} role="alert">
            {shown.map((message) => (
              <FieldError key={message}>{message}</FieldError>
            ))}
          </Errors>
        )}
      </form>
    )
  }

  return (
    <form id={formID} onSubmit={handleSubmit} noValidate>
      <Stack $gap={14}>
        {detailed && (
          <Field name="title">
            {({
              field,
              form: { errors: fieldErrors },
            }: FieldProps<string | undefined, EvidenceFormValues>) => (
              <FieldBlock>
                <FieldLabel htmlFor={`${formID}-title`}>
                  Title <Required>required</Required>
                </FieldLabel>
                <TextInput
                  id={`${formID}-title`}
                  {...field}
                  value={field.value ?? ''}
                  placeholder="A short title for this evidence"
                  maxLength={255}
                  aria-invalid={!!fieldErrors.title}
                />
                {fieldErrors.title && (
                  <FieldError role="alert">
                    {String(fieldErrors.title)}
                  </FieldError>
                )}
              </FieldBlock>
            )}
          </Field>
        )}
        <Field name="description">
          {({
            field,
            form: { errors: fieldErrors },
          }: FieldProps<string | undefined, EvidenceFormValues>) => (
            <FieldBlock>
              <LabelRow>
                <FieldLabel htmlFor={`${formID}-description`}>
                  Description <Required>required</Required>
                </FieldLabel>
                {previewToggle}
              </LabelRow>
              <Textarea
                id={`${formID}-description`}
                ref={descriptionRef}
                $hidden={showPreview}
                {...field}
                value={field.value ?? ''}
                rows={5}
                placeholder="What the jurors should know, with references to the listing policy. Markdown works."
                aria-invalid={!!fieldErrors.description}
                aria-describedby={counting ? countId : undefined}
              />
              {preview && <FieldPreview>{preview}</FieldPreview>}
              {count}
              {fieldErrors.description && (
                <FieldError role="alert">
                  {String(fieldErrors.description)}
                </FieldError>
              )}
            </FieldBlock>
          )}
        </Field>
        <FieldBlock>
          <FieldLabel htmlFor={`${formID}-file`}>Attachment</FieldLabel>
          <FileDropWell
            $over={drop.over}
            $refusing={!!drop.refusal}
            $disabled={sending}
            {...drop.handlers}
          >
            {file && previewUrl && file.type.includes('image') ? (
              <Preview src={previewUrl} alt="" />
            ) : (
              <FileIcon aria-hidden>
                {file ? (
                  <CurateIcon name="policy" size={16} />
                ) : (
                  <PaperclipIcon />
                )}
              </FileIcon>
            )}
            <FileMeta>
              <Data title={file?.name}>
                {drop.over
                  ? drop.refusal || (file ? DROP_REPLACE : DROP_HINT)
                  : (file?.name ?? 'Drop a file here or choose one')}
              </Data>
              <Small $muted>
                {file ? formatSize(file.size) : `Optional, up to ${sizeLabel}.`}
              </Small>
            </FileMeta>
            <PickRow>
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                disabled={sending}
                aria-label={file ? 'Replace the attachment' : undefined}
                onClick={() => inputRef.current?.click()}
              >
                {file ? 'Replace' : 'Attach a file'}
              </Button>
              {file && (
                <Button
                  type="button"
                  $variant="ghost"
                  $size="sm"
                  disabled={sending}
                  aria-label="Remove the attachment"
                  onClick={() => setFieldValue('evidenceAttachment', undefined)}
                >
                  Remove
                </Button>
              )}
            </PickRow>
          </FileDropWell>
          {fileInput}
          {fileError && <FieldError role="alert">{fileError}</FieldError>}
        </FieldBlock>
      </Stack>
    </form>
  )
}

const validationSchema = ({ detailed }: { detailed?: boolean }) =>
  yup.object().shape({
    ...(detailed
      ? {
          title: yup
            .string()
            .required('An evidence title is required.')
            .max(
              255,
              'The evidence title should be at most 255 characters long.',
            ),
        }
      : {}),
    description: yup
      .string()
      .required('An evidence description is required.')
      .max(DESCRIPTION_MAX, ({ value }: { value?: string }) => {
        const over = (value?.length ?? 0) - DESCRIPTION_MAX
        return `The description is ${integer.format(over)} character${
          over === 1 ? '' : 's'
        } too long (${integer.format(DESCRIPTION_MAX)} at most).`
      }),
  })

export default withFormik<EvidenceFormOuterProps, EvidenceFormValues>({
  validationSchema,
  /*
   * Hand formik the caller's promise, so isSubmitting is set for exactly as
   * long as the piece is going out. A handler that returns nothing is done
   * when it returns, and formik leaves the flag set unless it is told.
   */
  handleSubmit: (values, { props: { onSubmit }, setSubmitting }) => {
    const sent = onSubmit(values)
    if (sent instanceof Promise) return sent
    setSubmitting(false)
    return undefined
  },
})(EvidenceForm)
