import React, { useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'
import { Link, useParams } from 'react-router-dom'
import { useFormik } from 'formik'
import { ItemTypes } from '@kleros/gtcr-encoder'
import useDocumentHead from 'hooks/use-document-head'
import ListingCriteriaLink from 'components/listing-criteria-link'
import { getArticleFor } from 'utils/string'
import { parseIpfs } from 'utils/ipfs-parse'
import { parseRichAddress } from 'utils/rich-address'
import { reveal } from 'components/curate/motion/reveal'
import { tableColumns } from 'components/curate/entry-list'
import {
  ButtonLink,
  Label,
  Page,
  SkeletonBlock,
  StatusDot,
  Surface,
  truncateMiddle,
} from 'components/curate/primitives'
import { ColumnField, useObjectUrl } from './fields'
import {
  buildInitialValues,
  isEmptyField,
  isRequired,
  type FieldValue,
  missingRequired,
  normaliseValues,
  validateSubmission,
  type FactoryChecks,
  type SubmissionValues,
} from './form'
import type { Amount } from './amounts'
import {
  DepositPanel,
  type Outcome,
  type ReceiptPart,
  type WindowTerms,
} from './deposit-panel'
import { ConfirmAction, type ConfirmGate } from './confirm-action'
import type { SubmitHandler, SubmitPhase } from './use-submit-actions'

/*
 * Submission page, laid out like a checkout: on the left the title, one line
 * and the form as one calm panel (a live preview of the entry's row in the
 * list, built with the list's own column rules, then one field per column);
 * on the right, sticky, the featured "what happens next" panel with the
 * exact amount, its breakdown, the window, the outcomes, the policy, the one
 * action and a way back. Below 1000px the panel follows the form and a bar
 * with the amount, the action and Cancel sticks to the bottom. Every number comes
 * from the registry's own data.
 */

export type { ConfirmGate }

/** Everything the panel prints, computed from the registry's data. */
export interface SubmitTerms {
  /** The big figure: the total (classic, light) or the stake (Stake Curate). */
  headline?: Amount
  /** A second asset sent with it (Stake Curate's arbitration deposit). */
  extra?: { label: string; amount?: Amount }
  parts: ReceiptPart[]
  /** "51.6 xDAI", or "1000 PNK + 21.6 xDAI": repeated on the button. */
  amountText: string
  period?: WindowTerms
  outcomes: Outcome[]
  /** The entry's status right after submission, for the preview row. */
  status: { label: string; detail?: string }
}

export interface SubmitPageProps {
  registryPath: string
  registryTitle?: string
  itemName: string
  chainId?: number
  /** The one line under the title; a skeleton until every word is known. */
  lede?: string
  /** A quiet fact under it on narrow screens ("Challenge period · 3 days"),
   *  where the panel that shows the window sits below the form. */
  ledeMeta?: string
  columns?: Column[]
  initialValues?: unknown[]
  disabledFields?: boolean[]
  policyURI?: string | null
  terms: SubmitTerms
  /** Columns and deposit are known; until then the workspace is a skeleton. */
  ready: boolean
  gate: ConfirmGate
  phase: SubmitPhase
  submitting: boolean
  factoryChecks: FactoryChecks
  onSubmit: SubmitHandler
}

/* ---------- Layout ---------- */

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 408px;
  gap: 28px 36px;
  align-items: start;

  @media (max-width: 1180px) {
    grid-template-columns: minmax(0, 1fr) 372px;
    gap: 28px 24px;
  }

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`

const Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  min-width: 0;
`

const Aside = styled.aside`
  min-width: 0;

  /*
   * Sticky beside the form. --stick is set from the panel's height: under
   * the app bar when it fits, otherwise high enough that its bottom (the
   * action) stays in view.
   */
  @media (min-width: 1001px) {
    position: sticky;
    top: var(--stick, calc(var(--app-bar-height) + 20px));
  }
`

const GAP = 20

/** Keeps the sticky panel's action reachable when it is taller than the window. */
const useStickyTop = () => {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const update = () => {
      // The token lives on body, not on the root element.
      const appBar =
        parseFloat(
          getComputedStyle(document.body).getPropertyValue('--app-bar-height'),
        ) || 64
      const top = Math.min(
        appBar + GAP,
        window.innerHeight - node.offsetHeight - GAP,
      )
      node.style.setProperty('--stick', `${Math.round(top)}px`)
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])
  return ref
}

/**
 * Once the panel drops under the form, the sticky bar carries the action,
 * so the panel's copy hides.
 */
const DesktopAction = styled.div`
  @media (max-width: 1000px) {
    display: none;
  }
`

const CancelLink = styled(ButtonLink)`
  margin-top: 4px;
`

/* ---------- Header ---------- */

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 14px;

  > * {
    ${reveal}
  }
`

const Crumbs = styled.nav`
  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--color-faint);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  li[aria-current] {
    color: var(--color-muted);
  }

  a {
    color: inherit;
    text-decoration: none;
    transition: color var(--motion);
  }

  a:hover {
    color: var(--color-text);
  }
`

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M9 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const Title = styled.h1`
  margin: 4px 0 0;
  max-width: 18ch;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(36px, 2.6vw + 16px, 56px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.035em;
  text-wrap: balance;

  em {
    font-style: normal;
    color: var(--color-primary);
  }
`

const Lede = styled.p`
  margin: 0;
  max-width: 56ch;
  color: var(--color-muted);
  font-size: 17px;
  line-height: 26px;
`

const LedeMeta = styled.p`
  display: none;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;

  @media (max-width: 1000px) {
    display: inline-flex;
  }
`

/* ---------- Form panel ---------- */

const FormPanel = styled(Surface)`
  padding: 0;
  ${reveal}
`

const FormTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 20px;
  padding: 22px 28px 18px;

  @media (max-width: 720px) {
    padding: 18px 16px 14px;
  }
`

const Meter = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;

  b {
    color: var(--color-text);
    font-weight: 500;
  }
`

const Segments = styled.span`
  display: inline-flex;
  gap: 3px;
  width: clamp(72px, 12vw, 132px);

  i {
    flex: 1;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--color-raised);
    box-shadow: inset 0 0 0 1px var(--glass-border);
    transition:
      background 420ms cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  i[data-on='true'] {
    background: var(--color-primary);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--color-primary) 55%, transparent);
  }
`

const PreviewWrap = styled.div`
  padding: 0 28px 26px;
  border-bottom: 1px solid var(--glass-border);

  @media (max-width: 720px) {
    padding: 0 16px 20px;
  }
`

const PreviewRow = styled.div<{ $thumb: boolean }>`
  display: grid;
  grid-template-columns: ${({ $thumb }) =>
    $thumb ? '44px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto'};
  align-items: center;
  gap: 14px;
  min-height: 72px;
  padding: 12px 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);

  @media (max-width: 520px) {
    grid-template-columns: ${({ $thumb }) =>
      $thumb ? '44px minmax(0, 1fr)' : 'minmax(0, 1fr)'};
    padding: 12px 14px;
  }
`

/** The list's thumbnail: the entry's image, or an empty slot until there is one. */
const PreviewThumb = styled.span`
  display: block;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--color-surface);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const PreviewText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    overflow: hidden;
    color: var(--color-text);
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong[data-empty='true'] {
    color: var(--color-faint);
    font-weight: 400;
  }

  strong[data-mono='true'] {
    font-family: var(--font-mono);
    font-size: var(--fs-body);
  }
`

const PreviewMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 2px 10px;
  min-width: 0;
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: nowrap;

  span {
    min-width: 0;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Narrow rows wrap whole cells instead of cutting each one mid-word. */
  @media (max-width: 520px) {
    flex-wrap: wrap;

    span {
      max-width: 100%;
    }
  }

  span[data-empty='true'] {
    color: var(--color-faint);
  }

  [data-mono='true'] {
    font-family: var(--font-mono);
    font-size: 12px;
  }
`

const PreviewStatus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;

  b {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
  }

  span {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    white-space: nowrap;
  }

  @media (max-width: 520px) {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid var(--glass-border);
  }
`

const PreviewCaption = styled.p`
  margin: 10px 0 0 2px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
`

const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 30px 28px 34px;

  @media (max-width: 720px) {
    gap: 28px;
    padding: 22px 16px 26px;
  }
`

const PolicyLink = styled(ListingCriteriaLink)`
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

/* ---------- Phone bar ---------- */

/*
 * Shown from the width where the panel drops under the form. Tablets keep
 * the amount and the action on one row; phones stack them. The bottom margin
 * cancels the page's bottom padding so the bar ends flush with the page.
 */
const StickyBar = styled.div`
  display: none;

  @media (max-width: 1000px) {
    position: sticky;
    bottom: 0;
    z-index: 3;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
    align-items: center;
    gap: 0 24px;
    margin: 28px calc(-1 * var(--horizontal-padding)) -96px;
    padding: 14px var(--horizontal-padding)
      calc(14px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--glass-border);
    background: var(--color-surface);
    box-shadow: 0 -16px 40px -24px var(--color-bg);

    /* The action's status line sits under the button. */
    > p {
      grid-column: 2;
    }
  }

  @media (max-width: 720px) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin: 20px calc(-1 * var(--horizontal-padding)) -64px;
  }
`

const BarTotal = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  > a {
    margin-left: -10px;
  }
`

/** Label over the amount, so a two-asset amount stays on one line. */
const BarAmount = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;

  strong {
    color: var(--color-text);
    font-family: var(--font-figure, var(--font-display));
    font-size: 22px;
    line-height: 26px;
    font-weight: 500;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
`

/* ---------- Preview content ---------- */

const PLAIN_TEXT = new Set<string>([ItemTypes.TEXT, ItemTypes.LONG_TEXT])
const isImageColumn = (column: Column) => column.type === ItemTypes.IMAGE

/**
 * The list's own rules (entry-list): the row shows the identifier columns
 * (then image columns, at most four); the title is the first plain-text one,
 * else the first non-image one, and the rest follow as the meta line.
 */
const rowColumns = (columns: Column[]) => {
  const shown = tableColumns(columns) as Column[]
  const textual = shown.filter((column) => !isImageColumn(column))
  const title =
    textual.find((column) => !column.type || PLAIN_TEXT.has(column.type)) ??
    textual[0]
  return { title, meta: textual.filter((column) => column !== title) }
}

/**
 * A value as the row prints it: addresses truncated in mono, files by name.
 * Until a value is typed, the row shows the column's name in its place.
 */
const rowText = (
  column: Column,
  value: FieldValue | undefined,
): { text: string; mono?: boolean } | undefined => {
  if (value instanceof File) return { text: value.name }
  if (typeof value !== 'string' || isEmptyField(column, value)) return undefined
  const text = value.trim()
  if (
    column.type === ItemTypes.ADDRESS ||
    column.type === ItemTypes.GTCR_ADDRESS
  )
    return { text: truncateMiddle(text, 6, 4), mono: true }
  if (column.type === ItemTypes.RICH_ADDRESS) {
    const parsed = parseRichAddress(text)
    return parsed
      ? {
          text: `${parsed.reference.label} ${truncateMiddle(parsed.address, 6, 4)}`,
          mono: true,
        }
      : { text, mono: true }
  }
  if (column.type === ItemTypes.BOOLEAN)
    return { text: text === 'true' ? 'Yes' : 'No' }
  return { text }
}

const EntryPreview = ({
  columns,
  values,
  itemName,
  registryTitle,
  status,
}: {
  columns: Column[]
  values: SubmissionValues
  itemName: string
  registryTitle?: string
  status: SubmitTerms['status']
}) => {
  const { title, meta } = rowColumns(columns)
  // Lists with an image column show a thumbnail on every row.
  const imageColumn = columns.find(isImageColumn)
  const imageValue = imageColumn ? values[imageColumn.label] : undefined
  const file = imageValue instanceof File ? imageValue : undefined
  const objectUrl = useObjectUrl(file)
  const image =
    objectUrl ||
    (typeof imageValue === 'string' && imageValue ? parseIpfs(imageValue) : '')
  const titleText = title ? rowText(title, values[title.label]) : undefined

  return (
    <PreviewWrap>
      <PreviewRow
        $thumb={!!imageColumn}
        aria-label={`Preview of your ${itemName} as a row in the list`}
      >
        {imageColumn && (
          <PreviewThumb aria-hidden>
            {image && <img src={image} alt="" />}
          </PreviewThumb>
        )}
        <PreviewText>
          <strong
            data-empty={!titleText}
            data-mono={titleText?.mono || undefined}
          >
            {titleText?.text ?? title?.label ?? `Your ${itemName}`}
          </strong>
          {meta.length > 0 && (
            <PreviewMeta>
              {meta.map((column) => {
                const cell = rowText(column, values[column.label])
                return (
                  <span
                    key={column.label}
                    title={column.label}
                    data-empty={!cell}
                    data-mono={cell?.mono || undefined}
                  >
                    {cell?.text ?? column.label}
                  </span>
                )
              })}
            </PreviewMeta>
          )}
        </PreviewText>
        <PreviewStatus>
          <b>
            <StatusDot $tone="window" aria-hidden />
            {status.label}
          </b>
          {status.detail && <span>{status.detail}</span>}
        </PreviewStatus>
      </PreviewRow>
      <PreviewCaption>
        How your {itemName} will read in {registryTitle ?? 'the list'}
      </PreviewCaption>
    </PreviewWrap>
  )
}

const RequiredMeter = ({
  total,
  filled,
}: {
  total: number
  filled: number
}) => (
  <Meter
    role="progressbar"
    aria-label="Required fields filled"
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={filled}
    aria-valuetext={`${filled} of ${total} required fields filled`}
  >
    <span>
      <b>{filled}</b> of {total} required
    </span>
    <Segments aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} data-on={index < filled} />
      ))}
    </Segments>
  </Meter>
)

/* ---------- Page ---------- */

const PageHeader = ({
  registryPath,
  registryTitle,
  itemName,
  lede,
  ledeMeta,
}: Pick<
  SubmitPageProps,
  'registryPath' | 'registryTitle' | 'itemName' | 'lede' | 'ledeMeta'
>) => {
  const article = getArticleFor(itemName)
  return (
    <Header>
      <Crumbs aria-label="Breadcrumb" style={{ ['--i' as string]: 0 }}>
        <ol>
          <li>
            <Link to="/browse">Registries</Link>
          </li>
          <li>
            <Chevron />
            <Link to={registryPath}>{registryTitle ?? 'Registry'}</Link>
          </li>
          <li aria-current="page">
            <Chevron />
            Submit {article} {itemName}
          </li>
        </ol>
      </Crumbs>
      {registryTitle ? (
        <Title style={{ ['--i' as string]: 1 }}>
          Submit {article} {itemName} to <em>{registryTitle}</em>
        </Title>
      ) : (
        <SkeletonBlock $height="52px" $width="min(100%, 560px)" />
      )}
      {lede ? (
        <Lede style={{ ['--i' as string]: 2 }}>{lede}</Lede>
      ) : (
        <SkeletonBlock $height="26px" $width="min(100%, 600px)" />
      )}
      {lede && ledeMeta && (
        <LedeMeta style={{ ['--i' as string]: 2 }}>
          <StatusDot $tone="window" aria-hidden />
          {ledeMeta}
        </LedeMeta>
      )}
    </Header>
  )
}

type HeaderProps = Pick<
  SubmitPageProps,
  'registryPath' | 'registryTitle' | 'itemName' | 'lede' | 'ledeMeta'
>

const LoadingWorkspace = (props: HeaderProps) => (
  <Layout aria-busy>
    <Main>
      <PageHeader {...props} />
      <FormPanel>
        <FormTop>
          <SkeletonBlock $height="16px" $width="120px" />
          <SkeletonBlock $height="16px" $width="160px" />
        </FormTop>
        <PreviewWrap>
          <SkeletonBlock $height="72px" />
        </PreviewWrap>
        <Fields>
          {[0, 1, 2].map((index) => (
            <div key={index}>
              <SkeletonBlock $height="20px" $width="28%" />
              <div style={{ height: 10 }} />
              <SkeletonBlock $height="48px" />
            </div>
          ))}
        </Fields>
      </FormPanel>
    </Main>
    <Aside>
      <Surface $padding="standard">
        <SkeletonBlock $height="14px" $width="40%" />
        <div style={{ height: 14 }} />
        <SkeletonBlock $height="56px" $width="70%" />
        <div style={{ height: 22 }} />
        <SkeletonBlock $height="96px" />
        <div style={{ height: 22 }} />
        <SkeletonBlock $height="160px" />
        <div style={{ height: 22 }} />
        <SkeletonBlock $height="50px" />
      </Surface>
    </Aside>
  </Layout>
)

const Workspace = ({
  columns,
  confirmLabel,
  ...props
}: SubmitPageProps & { columns: Column[]; confirmLabel: string }) => {
  const {
    initialValues,
    disabledFields,
    factoryChecks,
    onSubmit,
    gate,
    phase,
    submitting,
    terms,
    policyURI,
    itemName,
    registryTitle,
    registryPath,
    chainId,
  } = props
  const initial = useMemo(
    () => buildInitialValues(columns, initialValues),
    [columns, initialValues],
  )
  const asideRef = useStickyTop()
  const formik = useFormik<SubmissionValues>({
    initialValues: initial,
    // Validation runs the list-creator subgraph checks for GTCR address
    // columns, so it waits for blur and submit instead of every keystroke.
    validateOnChange: false,
    validate: (values) => validateSubmission(columns, values, factoryChecks),
    onSubmit: (values, helpers) => {
      // Enter in a field submits the form too: the gate still applies.
      if (gate.blocker || submitting) return undefined
      return onSubmit(
        normaliseValues(columns, values),
        columns,
        helpers.resetForm,
        helpers.setFieldValue,
      )
    },
  })

  const requiredColumns = columns.filter((column) => isRequired(column))
  const missing = missingRequired(columns, formik.values)
  const highlighted = columns.some(
    (column) => formik.errors[column.label] && formik.touched[column.label],
  )
  const formBlocker =
    missing > 0
      ? `Fill in ${missing} required field${missing === 1 ? '' : 's'} to submit`
      : highlighted
        ? 'Fix the highlighted fields to submit'
        : ''

  const confirm = () => {
    formik.submitForm().catch((err) => {
      console.error('Error validating the submission:', err)
    })
  }

  const action = (
    <ConfirmAction
      gate={gate}
      formBlocker={formBlocker}
      submitting={submitting}
      phase={phase}
      itemName={itemName}
      confirmLabel={confirmLabel}
      amountText={terms.amountText}
      onConfirm={confirm}
    />
  )

  const policy = policyURI ? (
    <>
      Read the <PolicyLink fileURI={policyURI}>listing policy</PolicyLink>{' '}
      before you submit.
    </>
  ) : undefined

  return (
    <>
      <Layout>
        <Main>
          <PageHeader {...props} />
          <FormPanel style={{ ['--i' as string]: 3 }}>
            <form
              id="submit-item-form"
              noValidate
              aria-busy={submitting}
              onSubmit={formik.handleSubmit}
            >
              <FormTop>
                <Label $tone="faint">Your {itemName}</Label>
                {requiredColumns.length > 0 && (
                  <RequiredMeter
                    total={requiredColumns.length}
                    filled={requiredColumns.length - missing}
                  />
                )}
              </FormTop>
              <EntryPreview
                columns={columns}
                values={formik.values}
                itemName={itemName}
                registryTitle={registryTitle}
                status={terms.status}
              />
              <Fields>
                {columns.map((column, index) => (
                  <ColumnField
                    key={column.label}
                    column={column}
                    value={formik.values[column.label]}
                    error={formik.errors[column.label]}
                    showError={!!formik.touched[column.label]}
                    disabled={submitting || !!disabledFields?.[index]}
                    onChange={(value) =>
                      formik.setFieldValue(column.label, value)
                    }
                    onBlur={() => formik.setFieldTouched(column.label, true)}
                    onCommit={(value) => {
                      formik.setFieldTouched(column.label, true, false)
                      formik.setFieldValue(column.label, value, true)
                    }}
                  />
                ))}
              </Fields>
            </form>
          </FormPanel>
        </Main>

        <Aside ref={asideRef}>
          <DepositPanel
            chainId={chainId}
            headline={terms.headline}
            extra={terms.extra}
            parts={terms.parts}
            period={terms.period}
            outcomes={terms.outcomes}
            policy={policy}
            action={
              <DesktopAction>
                {action}
                <CancelLink
                  to={registryPath}
                  $variant="ghost"
                  $size="sm"
                  $block
                >
                  Cancel
                </CancelLink>
              </DesktopAction>
            }
          />
        </Aside>
      </Layout>

      <StickyBar>
        <BarTotal>
          <ButtonLink to={registryPath} $variant="ghost" $size="sm">
            Cancel
          </ButtonLink>
          <BarAmount>
            <Label $tone="faint">You send now</Label>
            <strong>{terms.amountText}</strong>
          </BarAmount>
        </BarTotal>
        {action}
      </StickyBar>
    </>
  )
}

export const SubmitPage = (props: SubmitPageProps) => {
  const { registryTitle, itemName, ready, columns } = props
  const article = getArticleFor(itemName)
  const confirmLabel = `Submit ${article} ${itemName}`
  useDocumentHead(
    `Submit ${article} ${itemName} · ${registryTitle ?? 'Kleros Curate'}`,
  )

  return (
    <Page>
      {ready && columns ? (
        <Workspace {...props} columns={columns} confirmLabel={confirmLabel} />
      ) : (
        <LoadingWorkspace {...props} />
      )}
    </Page>
  )
}

/**
 * The page's skeleton while the registry kind, its providers or its data
 * load: the same layout, so nothing jumps when the form arrives.
 */
export const SubmitPageSkeleton = () => {
  const { chainId, tcrAddress } = useParams<{
    chainId: string
    tcrAddress: string
  }>()
  return (
    <Page>
      <LoadingWorkspace
        registryPath={`/tcr/${chainId}/${tcrAddress}`}
        itemName="item"
      />
    </Page>
  )
}

export default SubmitPage
