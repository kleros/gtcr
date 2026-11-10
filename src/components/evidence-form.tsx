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
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { FieldError, FieldLabel } from 'components/curate/item-light-notice'

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
 */

const MAX_FILE_MB = 4

const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Textarea = styled.textarea`
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
`

const Attachment = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
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
  flex: 1;
  min-width: 0;

  > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
const Box = styled.div<{ $invalid: boolean }>`
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
    box-shadow var(--motion);

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
const BodyField = styled.textarea`
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

  &:hover {
    background: var(--color-surface);
    color: var(--color-text);
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
`

const ToolbarEnd = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
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
  onSubmit: (values: EvidenceFormValues) => void
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
  handleSubmit,
  setFieldValue,
  values,
  errors,
  submitCount,
}: EvidenceFormProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorsId = useId()
  const file = values.evidenceAttachment as File | undefined
  const drafted = !!(values.title || values.description || file)

  useEffect(() => {
    onDraftChange?.(drafted)
  }, [drafted, onDraftChange])

  // Defer the actual IPFS upload to submit time. The parent's confirm button
  // is the EnsureAuth/SIWE gate; if we uploaded here the request would race
  // the sign-in flow and fail before the user is verified.
  const onPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (!picked) return
      if (picked.size / 1024 / 1024 >= MAX_FILE_MB) {
        setFileError(`File must be smaller than ${MAX_FILE_MB}MB.`)
        return
      }
      setFileError(null)
      setFieldValue('evidenceAttachment', picked)
    },
    [setFieldValue],
  )

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
        <Box $invalid={shown.length > 0}>
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
                  {...field}
                  value={field.value ?? ''}
                  onChange={(event) => {
                    field.onChange(event)
                    fitHeight(event.currentTarget)
                  }}
                  rows={3}
                  placeholder="What should the jurors know? Point to the listing policy."
                  aria-invalid={submitCount > 0 && !!errors.description}
                  aria-describedby={shown.length > 0 ? errorsId : undefined}
                />
              </>
            )}
          </Field>
          <Toolbar>
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
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFieldValue('evidenceAttachment', undefined)}
                >
                  <CurateIcon name="close" size={12} />
                </IconButton>
              </FileChip>
            ) : (
              <Attach type="button" onClick={() => inputRef.current?.click()}>
                <PaperclipIcon />
                Attach a file
                <span>
                  <span aria-hidden>· </span>up to {MAX_FILE_MB} MB
                </span>
              </Attach>
            )}
            {actions && <ToolbarEnd>{actions}</ToolbarEnd>}
          </Toolbar>
          {fileInput}
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
                <FieldLabel htmlFor={`${formID}-title`}>Title</FieldLabel>
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
              <FieldLabel htmlFor={`${formID}-description`}>
                Description
              </FieldLabel>
              <Textarea
                id={`${formID}-description`}
                {...field}
                value={field.value ?? ''}
                rows={5}
                placeholder="What the jurors should know, with references to the listing policy"
                aria-invalid={!!fieldErrors.description}
              />
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
          {file ? (
            <Attachment>
              {previewUrl && file.type.includes('image') ? (
                <Preview src={previewUrl} alt="" />
              ) : (
                <FileIcon aria-hidden>
                  <CurateIcon name="policy" size={16} />
                </FileIcon>
              )}
              <FileMeta>
                <Data title={file.name}>{file.name}</Data>
                <Small $muted>{formatSize(file.size)}</Small>
              </FileMeta>
              <IconButton
                type="button"
                aria-label="Remove attachment"
                onClick={() => setFieldValue('evidenceAttachment', undefined)}
              >
                <CurateIcon name="close" size={14} />
              </IconButton>
            </Attachment>
          ) : (
            <PickRow>
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Attach a file
              </Button>
              <Small $muted>Optional, up to {MAX_FILE_MB} MB.</Small>
            </PickRow>
          )}
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
      .max(1024, 'The description must be less than 1024 characters long.'),
  })

export default withFormik<EvidenceFormOuterProps, EvidenceFormValues>({
  validationSchema,
  handleSubmit: (values, { props: { onSubmit } }) => {
    onSubmit(values)
  },
})(EvidenceForm)
