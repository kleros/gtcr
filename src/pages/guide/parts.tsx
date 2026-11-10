import React from 'react'
import styled from 'styled-components'
import { CurateIcon } from 'components/curate/icons'
import { Label, Small, StatusDot, Surface } from 'components/curate/primitives'
import { VerifiedBadge } from 'components/curate/verified-badge'
import {
  SECTIONS,
  sectionNumber,
  type CostRow,
  type GuideStep,
  type LegendItem,
  type OutcomeKind,
  type OutcomeRole,
} from './content'
import { useJump } from './table-of-contents'

/*
 * The guide's reading pieces: section heads in display type, prose at a 68ch
 * measure, numbered steps on a rail, cost rows with what comes back, asides,
 * the status legend, the outcome panel, the two roles side by side, the Stake
 * Curate comparison and definition grids. Separation comes from space and
 * hairlines; the only panels are the drawings, the live count and the
 * outcome table.
 */

export const MEASURE = '68ch'

/** Read by screen readers, not drawn. */
export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/* ---------- Section frame ---------- */

export const EyebrowRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  b {
    color: var(--color-primary);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  i {
    width: 20px;
    height: 1px;
    background: var(--color-border-strong);
  }
`

export const Eyebrow = ({ id }: { id: string }) => (
  <EyebrowRow>
    <b>{sectionNumber(id)}</b>
    <i aria-hidden />
    <Label>{SECTIONS.find((section) => section.id === id)?.label}</Label>
  </EyebrowRow>
)

const Shell = styled.section`
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin-top: 104px;
  scroll-margin-top: calc(var(--app-bar-height) + 32px);

  @media (max-width: 1023px) {
    scroll-margin-top: calc(var(--app-bar-height) + 72px);
  }

  @media (max-width: 720px) {
    margin-top: 72px;
  }
`

const Head = styled.header`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 2px;
`

export const SectionTitle = styled.h2`
  margin: 0;
  max-width: 30ch;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 0.8vw + 18px, 30px);
  line-height: 1.12;
  font-weight: 500;
  letter-spacing: -0.03em;
  text-wrap: balance;
`

export const GuideSection = ({
  id,
  heading,
  children,
}: {
  id: string
  heading: string
  children: React.ReactNode
}) => (
  <Shell id={id} aria-labelledby={`${id}-title`}>
    <Head>
      <Eyebrow id={id} />
      <SectionTitle id={`${id}-title`}>{heading}</SectionTitle>
    </Head>
    {children}
  </Shell>
)

/* ---------- Text ---------- */

export const Prose = styled.p<{ $quiet?: boolean }>`
  margin: 0;
  max-width: ${MEASURE};
  color: var(--color-muted);
  font-size: ${({ $quiet }) => ($quiet ? '14px' : '16px')};
  line-height: ${({ $quiet }) => ($quiet ? '22px' : '28px')};
  text-wrap: pretty;

  strong {
    color: var(--color-text);
    font-weight: 500;
  }

  a {
    color: var(--color-primary);
  }

  @media (max-width: 720px) {
    font-size: ${({ $quiet }) => ($quiet ? '14px' : '15px')};
    line-height: ${({ $quiet }) => ($quiet ? '22px' : '26px')};
  }
`

const AsideBox = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: ${MEASURE};
  padding: 14px 18px 15px 20px;
  border-radius: var(--radius);
  background: var(--color-raised);
  box-shadow: inset 2px 0 0 var(--color-primary);

  p {
    margin: 0;
    color: var(--color-text);
    font-size: 15px;
    line-height: 24px;
    text-wrap: pretty;
  }
`

export const Aside = ({
  label = 'Keep in mind',
  children,
}: {
  label?: string
  children: React.ReactNode
}) => (
  <AsideBox role="note">
    <Label $tone="primary">{label}</Label>
    <p>{children}</p>
  </AsideBox>
)

/* ---------- Cross-references ---------- */

/** "See 07": a jump to another section, read out with its name. */
export const SeeLinks = ({ ids }: { ids: string[] }) => {
  const jump = useJump()
  return (
    <>
      See{' '}
      {ids.map((id, index) => (
        <React.Fragment key={id}>
          {index > 0 && ', '}
          <a
            href={`#${id}`}
            onClick={(event) => jump(event, id)}
            aria-label={`Section ${sectionNumber(id)}: ${
              SECTIONS.find((section) => section.id === id)?.label
            }`}
          >
            {sectionNumber(id)}
          </a>
        </React.Fragment>
      ))}
      .
    </>
  )
}

/* ---------- Outcome marks ---------- */

const MARK: Record<OutcomeKind, { glyph: string; tone: string; name: string }> =
  {
    gain: {
      glyph: '+',
      tone: 'var(--color-success)',
      name: 'More than you put in',
    },
    loss: {
      glyph: '−',
      tone: 'var(--color-danger)',
      name: 'Goes to the other side',
    },
    back: { glyph: '=', tone: 'var(--color-muted)', name: 'Returned' },
  }

const Mark = styled.i<{ $tone: string }>`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, ${({ $tone }) => $tone} 16%, transparent);
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, ${({ $tone }) => $tone} 30%, transparent);
  /* Pulled toward the text color so the glyph clears 4.5:1 on its tint. */
  color: color-mix(in srgb, ${({ $tone }) => $tone} 80%, var(--color-text));
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: 1;
`

/* ---------- Steps ---------- */

const StepRail = styled.ol`
  display: flex;
  flex-direction: column;
  max-width: ${MEASURE};
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
`

const StepItem = styled.li`
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 16px;
  padding-bottom: 22px;
  counter-increment: step;

  &::before {
    content: counter(step);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-pill);
    background: var(--color-raised);
    box-shadow: inset 0 1px 0 var(--glass-highlight);
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  &::after {
    content: '';
    position: absolute;
    top: 38px;
    bottom: 6px;
    left: 15.5px;
    width: 1px;
    background: var(--glass-border);
  }

  &:last-child {
    padding-bottom: 0;
  }

  &:last-child::after {
    display: none;
  }

  b {
    display: block;
    margin-top: 5px;
    color: var(--color-text);
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
  }

  p {
    margin: 4px 0 0;
    color: var(--color-muted);
    font-size: 15px;
    line-height: 24px;
    text-wrap: pretty;
  }

  p a {
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
    text-decoration: none;
  }

  p a:hover {
    text-decoration: underline;
  }
`

export const Steps = ({ steps }: { steps: GuideStep[] }) => (
  <StepRail>
    {steps.map((step) => (
      <StepItem key={step.title}>
        <div>
          <b>{step.title}</b>
          <p>
            {step.body}
            {step.see && (
              <>
                {' '}
                <SeeLinks ids={step.see} />
              </>
            )}
          </p>
        </div>
      </StepItem>
    ))}
  </StepRail>
)

/* ---------- Costs ---------- */

const CostBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const CostRows = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;

  > div {
    display: grid;
    grid-template-columns: 172px minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 8px 16px;
    align-items: center;
    min-height: 56px;
    padding: 10px 18px;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius);
    background: var(--color-raised);
  }

  dt {
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  /* What comes back, and when. */
  dd + dd {
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: 22px;
  }

  @media (max-width: 1180px) {
    > div {
      grid-template-columns: 172px minmax(0, 1fr);
    }

    dd + dd {
      grid-column: 2;
    }
  }

  @media (max-width: 720px) {
    > div {
      grid-template-columns: 1fr;
      padding: 12px 14px;
    }

    dd + dd {
      grid-column: auto;
    }
  }
`

const Term = styled.span<{ $muted?: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: ${({ $muted }) =>
    $muted ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Plus = styled.span`
  color: var(--color-faint);
  font-size: 15px;
`

export const Costs = ({
  label,
  rows,
  note,
}: {
  label: string
  rows: CostRow[]
  /** One line under the rows: how a challenged pot is split. */
  note?: string
}) => (
  <CostBlock>
    <Label $tone="faint">{label}</Label>
    <CostRows aria-label={label}>
      {rows.map((row) => (
        <div key={row.action}>
          <dt>{row.action}</dt>
          <dd>
            <Term>{row.base}</Term>
            <Plus aria-hidden>+</Plus>
            <VisuallyHidden> plus </VisuallyHidden>
            <Term $muted>arbitration cost</Term>
          </dd>
          <dd>
            <span>
              <VisuallyHidden>Comes back: </VisuallyHidden>
              {row.back}
            </span>
          </dd>
        </div>
      ))}
    </CostRows>
    {note && <Small $muted>{note}</Small>}
  </CostBlock>
)

/* ---------- Status legend ---------- */

const LegendGroup = styled.div`
  display: flex;
  flex-direction: column;

  & + & {
    margin-top: 28px;
  }
`

const LegendHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
`

const LegendRows = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    position: relative;
    display: grid;
    grid-template-columns: minmax(360px, 42%) minmax(0, 1fr);
    gap: 4px 20px;
    align-items: center;
    min-height: 52px;
    padding: 10px 12px;
    margin: 0 -12px;
    border-radius: var(--radius);
    transition: background var(--motion);
  }

  /* The hairline sits inside the row's padding so the rounded hover fill
     does not bend it at the corners. */
  li::before {
    content: '';
    position: absolute;
    top: 0;
    right: 12px;
    left: 12px;
    height: 1px;
    background: var(--glass-border);
    transition: opacity var(--motion);
  }

  li:hover {
    background: var(--color-raised);
  }

  li:hover::before,
  li:hover + li::before {
    opacity: 0;
  }

  li > span:last-child {
    color: var(--color-muted);
    font-size: var(--fs-body);
    line-height: 22px;
  }

  @media (max-width: 720px) {
    li {
      grid-template-columns: 1fr;
      padding: 12px;
    }
  }
`

/* Set like the entry rows (components/curate/entry-status): dot, sans label,
   muted detail. Long details wrap under the label, not under the dot. */
const LegendStatus = styled.span`
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  column-gap: 8px;
  align-items: start;
  min-width: 0;

  > span:first-child {
    margin-top: calc((var(--lh-small) - 8px) / 2);
  }

  b {
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
  }

  i {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-style: normal;
    font-variant-numeric: tabular-nums;
  }
`

export const StatusLegend = ({
  groups,
}: {
  groups: { group: string; items: LegendItem[] }[]
}) => (
  <div>
    {groups.map((group) => (
      <LegendGroup key={group.group}>
        <LegendHead>
          <Label $tone="text">{group.group}</Label>
          <Small $faint>{group.items.length} statuses</Small>
        </LegendHead>
        <LegendRows>
          {group.items.map((item) => (
            <li key={item.label}>
              <LegendStatus>
                <StatusDot $tone={item.tone} aria-hidden />
                <span>
                  <b>{item.label}</b>
                  {item.detail && <i> · {item.detail}</i>}
                </span>
              </LegendStatus>
              <span>{item.meaning}</span>
            </li>
          ))}
        </LegendRows>
      </LegendGroup>
    ))}
  </div>
)

/* ---------- Outcomes ---------- */

const OutcomePanel = styled(Surface)`
  overflow: hidden;
`

const OutcomeHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 20px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--glass-border);

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 12px;
  }

  @media (max-width: 720px) {
    padding: 16px;
  }
`

const OutcomeColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  > div {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 22px 24px 24px;
    border-left: 1px solid var(--glass-border);
  }

  > div:first-child {
    border-left: 0;
  }

  h3 {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 19px;
    line-height: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  }

  b {
    display: block;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: 20px;
    font-weight: 500;
  }

  li span {
    display: block;
    margin-top: 2px;
    color: var(--color-muted);
    font-size: var(--fs-body);
    line-height: 21px;
  }

  @media (max-width: 960px) {
    grid-template-columns: 1fr;

    > div {
      border-left: 0;
      border-top: 1px solid var(--glass-border);
    }

    > div:first-child {
      border-top: 0;
    }
  }

  @media (max-width: 720px) {
    > div {
      padding: 18px 16px 20px;
    }
  }
`

export const OutcomeTable = ({
  title,
  roles,
}: {
  title: string
  roles: OutcomeRole[]
}) => (
  <OutcomePanel $padding="none" aria-label={title}>
    <OutcomeHead>
      <Label $tone="faint">{title}</Label>
      <ul aria-label="Key">
        {(Object.keys(MARK) as OutcomeKind[]).map((kind) => (
          <li key={kind}>
            <Mark $tone={MARK[kind].tone} aria-hidden>
              {MARK[kind].glyph}
            </Mark>
            {MARK[kind].name}
          </li>
        ))}
      </ul>
    </OutcomeHead>
    <OutcomeColumns>
      {roles.map((role) => (
        <div key={role.role}>
          <h3>{role.role}</h3>
          <ul>
            {role.rows.map((row) => (
              <li key={row.when}>
                <Mark
                  $tone={MARK[row.kind].tone}
                  title={MARK[row.kind].name}
                  aria-hidden
                >
                  {MARK[row.kind].glyph}
                </Mark>
                <div>
                  <b>
                    <VisuallyHidden>{MARK[row.kind].name}: </VisuallyHidden>
                    {row.when}
                  </b>
                  <span>{row.result}</span>
                </div>
              </li>
            ))}
          </ul>
          {role.footnote && (
            <Footnote>
              {role.footnote.text}
              {role.footnote.see && (
                <>
                  {' '}
                  <SeeLinks ids={[role.footnote.see]} />
                </>
              )}
            </Footnote>
          )}
        </div>
      ))}
    </OutcomeColumns>
  </OutcomePanel>
)

const Footnote = styled(Small).attrs({ $muted: true })`
  a {
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`

/* ---------- Comparison ---------- */

const CompareGrid = styled.table`
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  table-layout: fixed;

  th,
  td {
    padding: 14px 24px 15px 0;
    border-top: 1px solid var(--glass-border);
    text-align: left;
    vertical-align: top;
  }

  th:last-child,
  td:last-child {
    padding-right: 0;
  }

  thead th {
    padding-top: 0;
    padding-bottom: 10px;
    border-top: 0;
    font-weight: inherit;
  }

  tbody th {
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: 22px;
    font-weight: 500;
  }

  td {
    color: var(--color-muted);
    font-size: 15px;
    line-height: 23px;
    text-wrap: pretty;
  }

  /* On phones each row stacks: the aspect, then each kind with its name. */
  @media (max-width: 720px) {
    colgroup,
    thead {
      display: none;
    }

    tr {
      display: block;
      padding: 14px 0 16px;
      border-top: 1px solid var(--glass-border);
    }

    th,
    td {
      display: block;
      padding: 0;
      border-top: 0;
    }

    td {
      margin-top: 10px;
    }

    td::before {
      content: attr(data-label);
      display: block;
      margin-bottom: 2px;
      color: var(--color-faint);
      font-family: var(--font-label);
      font-size: var(--fs-label);
      line-height: var(--lh-label);
      font-weight: 500;
      letter-spacing: var(--tracking-label);
      text-transform: uppercase;
    }
  }
`

/** Two kinds of list side by side, one aspect per row, neither favoured. */
export const CompareTable = ({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: [string, string]
  rows: { aspect: string; classic: string; stake: string }[]
}) => (
  <CompareGrid>
    <VisuallyHidden as="caption">{caption}</VisuallyHidden>
    <colgroup>
      <col style={{ width: '22%' }} />
      <col />
      <col />
    </colgroup>
    <thead>
      <tr>
        <th scope="col">
          <VisuallyHidden>Aspect</VisuallyHidden>
        </th>
        {columns.map((column) => (
          <th key={column} scope="col">
            <Label $tone="text">{column}</Label>
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.aspect}>
          <th scope="row">{row.aspect}</th>
          <td data-label={columns[0]}>{row.classic}</td>
          <td data-label={columns[1]}>{row.stake}</td>
        </tr>
      ))}
    </tbody>
  </CompareGrid>
)

/* ---------- Roles ---------- */

const RoleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 40px;

  > div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 14px;
    border-top: 1px solid var(--glass-border);
  }

  p {
    margin: 0;
    max-width: 40ch;
    color: var(--color-text);
    font-size: 17px;
    line-height: 27px;
    letter-spacing: -0.005em;
    text-wrap: pretty;
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;

    p {
      font-size: 16px;
      line-height: 25px;
    }
  }
`

/** Two roles side by side, set alike so neither one leads. */
export const RolePair = ({
  roles,
}: {
  roles: { role: string; line: string }[]
}) => (
  <RoleGrid>
    {roles.map((item) => (
      <div key={item.role}>
        <Label $tone="faint">{item.role}</Label>
        <p>{item.line}</p>
      </div>
    ))}
  </RoleGrid>
)

/* ---------- Definitions ---------- */

export const Definitions = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 48px;
  margin: 0;

  > div {
    padding: 20px 0 24px;
    border-top: 1px solid var(--glass-border);
  }

  dt {
    margin-bottom: 6px;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 19px;
    line-height: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  dd {
    margin: 0;
    max-width: 52ch;
    color: var(--color-muted);
    font-size: 15px;
    line-height: 24px;
    text-wrap: pretty;
  }

  dd a {
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
    text-decoration: none;
  }

  dd a:hover {
    text-decoration: underline;
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;

    > div {
      padding: 16px 0 18px;
    }
  }
`

const TermSeal = styled(VerifiedBadge)`
  margin-right: 8px;
  vertical-align: -2px;
`

export const DefinitionGrid = ({
  label,
  items,
}: {
  label?: string
  items: {
    term: string
    definition: string
    see?: string[]
    /** Drawn before the term: the Kleros Verified seal. */
    mark?: 'verified'
  }[]
}) => (
  <div>
    {label && (
      <div style={{ marginBottom: 10 }}>
        <Label $tone="faint">{label}</Label>
      </div>
    )}
    <Definitions>
      {items.map((item) => (
        <div key={item.term}>
          <dt>
            {item.mark === 'verified' && <TermSeal size={18} decorative />}
            {item.term}
          </dt>
          <dd>
            {item.definition}
            {item.see && (
              <>
                {' '}
                <SeeLinks ids={item.see} />
              </>
            )}
          </dd>
        </div>
      ))}
    </Definitions>
  </div>
)

/* ---------- Links ---------- */

export const FileRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const FileRow = styled.a`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  min-height: 64px;
  padding: 12px 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion),
    transform var(--motion),
    background var(--motion);

  strong {
    display: block;
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  > svg {
    color: var(--color-faint);
    transition:
      color var(--motion),
      transform var(--motion);
  }

  &:hover {
    border-color: var(--color-border-strong);
    transform: translateY(-1px);
  }

  &:hover strong,
  &:hover > svg {
    color: var(--color-primary);
  }

  &:hover > svg {
    transform: translate(1px, -1px);
  }
`

export const SourceGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const SourceAnchor = styled.a`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-text);
  font-size: 15px;
  line-height: 22px;
  text-decoration: none;
  transition: color var(--motion);

  svg {
    flex: 0 0 auto;
    color: var(--color-faint);
    transition:
      color var(--motion),
      transform var(--motion);
  }

  &:hover {
    color: var(--color-primary);
  }

  &:hover svg {
    color: var(--color-primary);
    transform: translate(1px, -1px);
  }
`

export const External = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => (
  <SourceAnchor href={href} target="_blank" rel="noreferrer">
    {children}
    <CurateIcon name="external" size={14} />
  </SourceAnchor>
)
