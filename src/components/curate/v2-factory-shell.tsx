import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { CurateIcon } from 'components/curate/icons'
import { ctaFill, litEdgeBackground, litThumb } from 'components/ui/kit-styles'
import { reveal } from 'components/curate/motion/reveal'
import {
  Button,
  Label,
  Row,
  Small,
  Surface,
} from 'components/curate/primitives'

/*
 * What both list factories (Light and Stake) share: the wizard's state
 * (`useFactoryWizard`: where it is, how far it got, Start over, the return to
 * the review), the copy of the steps they have in common, a horizontal
 * stepper whose progress slides as the wizard advances, and the step panel
 * (its sub-step tabs, the form and the action bar) beside a sticky preview
 * column. Colors, type and radii come only from the tokens; every motion
 * respects reduced motion.
 */

/** One group of the stepper. */
export type FactoryStepDescriptor = {
  title: string
  description: string
  subitems?: string[]
}

/** One sub-step of the wizard. */
export type FactoryWizardStep = {
  title: string
  /** The form it renders, stored as the draft's `currStep`. */
  componentStep: number
  /** Its group in the stepper, 1-based. */
  groupStep: number
}

/** The part of a stored draft that says where the wizard is. */
export type FactoryWizardDraft = {
  currStep: number
  /** The sub-step the wizard was on, restored after a reload. */
  visualStep?: number
  /** The furthest sub-step reached; every step up to it can be reopened. */
  maxVisualStep?: number
}

/* ---------- Shared copy ---------- */

/** The steps both factories have, worded once so they read the same in each. */
export const FACTORY_COPY = {
  sections: {
    title: {
      heading: 'Name the list',
      lede: 'Short and plain: it shows on cards, in notifications and on the list of lists.',
    },
    description: {
      heading: 'Describe what belongs on it',
      lede: 'One sentence on the entries the list holds and what makes them eligible.',
    },
    logo: {
      heading: 'Add a logo',
      lede: 'It identifies the list wherever the list appears.',
    },
    policy: {
      heading: 'Attach the listing policy',
      lede: 'The document jurors and challengers use to decide whether an entry belongs.',
    },
    custom: {
      heading: 'Name the entries',
      lede: 'The word that replaces “item” across the interface, as in “Submit a sock”.',
    },
  },
  fields: {
    title: {
      label: 'Name',
      placeholder: 'Red socks',
      help: 'Up to 40 characters.',
    },
    description: {
      label: 'Description',
      placeholder: 'Images of red socks from various manufacturers',
      help: 'Up to 255 characters; shown under the name.',
    },
    itemName: {
      label: 'Item name',
      placeholder: 'sock',
      help: 'One entry, up to 20 characters.',
    },
    itemNamePlural: {
      label: 'Plural',
      placeholder: 'socks',
      help: 'Several entries, up to 20 characters.',
    },
  },
} as const

/** The browser tab title of a factory: "Create a Stake list | Kleros Curate". */
export const factoryDocumentTitle = (kind: 'Light' | 'Stake') =>
  `Create a ${kind} list | Kleros Curate`

/* ---------- Wizard state ---------- */

const clampIndex = (index: number, last: number) =>
  Math.max(0, Math.min(last, Math.round(index)))

const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Where a stored draft reopens: its sub-step, else the first one of its form. */
const restoredStep = (
  steps: FactoryWizardStep[],
  draft?: FactoryWizardDraft,
): number => {
  if (!draft) return 0
  if (isIndex(draft.visualStep))
    return clampIndex(draft.visualStep, steps.length - 1)
  const index = steps.findIndex((step) => step.componentStep === draft.currStep)
  return index < 0 ? 0 : index
}

/** How far a stored draft got: at least the step it reopens on. */
const restoredMax = (
  steps: FactoryWizardStep[],
  draft?: FactoryWizardDraft,
): number => {
  const step = restoredStep(steps, draft)
  return draft && isIndex(draft.maxVisualStep)
    ? Math.max(step, clampIndex(draft.maxVisualStep, steps.length - 1))
    : step
}

/** done: passed (a check); reached: open but not passed; next: closed. */
export type SubTabState = 'done' | 'reached' | 'current' | 'next'

/**
 * complete: every sub-step passed; active: the open group; reached: can be
 * opened, not fully passed; upcoming: closed.
 */
export type FactoryGroupStatus = 'complete' | 'active' | 'reached' | 'upcoming'

export interface FactoryWizard {
  steps: FactoryWizardStep[]
  /** The open sub-step. */
  index: number
  current: FactoryWizardStep
  isLast: boolean
  /** An Edit from the review is open: the primary action goes back to it. */
  reviewing: boolean
  /**
   * The furthest sub-step that opens from the tabs and the stepper: the
   * furthest one reached, cut at the first earlier step that no longer
   * validates (that step has to pass Next again).
   */
  reach: number
  /** Bumped by Start over, so the open step remounts with the cleared values. */
  resets: number
  confirmingReset: boolean
  tabState: (index: number) => SubTabState
  groupStatus: (group: number) => FactoryGroupStatus
  goToVisualStep: (index: number) => void
  /** Opens a group at its first sub-step. */
  goToGroup: (group: number) => void
  /** Next, or straight back to the review after an Edit from it. */
  advance: () => void
  /** An Edit from the review: opens the step and offers "Back to review". */
  editStep: (title: string) => void
  askReset: () => void
  keepEditing: () => void
  startOver: () => void
  panelRef: React.RefObject<HTMLDivElement>
  resetTriggerRef: React.RefObject<HTMLButtonElement>
  keepEditingRef: React.RefObject<HTMLButtonElement>
}

/**
 * The wizard's position, shared by both factories. It reopens a stored
 * draft on the sub-step it was on (or the first sub-step of its stored form
 * step), keeps how far it got, and writes both back to the draft on every
 * change, so a reload lands where the user left. A new chain in the URL
 * starts at the first step. `isStepValid` lets a step that no longer
 * validates close the steps after it.
 */
export const useFactoryWizard = <D extends FactoryWizardDraft>({
  steps,
  draft,
  setDraft,
  resetDraft,
  chainId,
  isStepValid,
  onNavigate,
}: {
  steps: FactoryWizardStep[]
  draft?: D
  setDraft?: React.Dispatch<React.SetStateAction<D>>
  resetDraft?: () => void
  chainId?: number
  isStepValid?: (step: FactoryWizardStep, index: number) => boolean
  /** Called on every move, e.g. to close a section an Edit opened. */
  onNavigate?: () => void
}): FactoryWizard => {
  const last = steps.length - 1
  const [step, setStep] = useState(() => restoredStep(steps, draft))
  const [max, setMax] = useState(() => restoredMax(steps, draft))
  const [returnToReview, setReturnToReview] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resets, setResets] = useState(0)
  const [stepChain, setStepChain] = useState(chainId)
  const panelRef = useRef<HTMLDivElement>(null)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  // Set when the confirmation closes from its own buttons: focus goes back
  // to the trigger, which remounts in place of the confirmation.
  const returnFocus = useRef(false)
  const firstStep = useRef(true)

  // A new chain in the URL starts a new draft at the first step.
  if (chainId !== stepChain) {
    setStepChain(chainId)
    setStep(0)
    setMax(0)
    setReturnToReview(false)
  }

  // The step list can be shorter than a stored index: clamp both.
  const index = clampIndex(step, last)
  const furthest = Math.max(index, clampIndex(max, last))
  const firstInvalid = isStepValid
    ? steps.findIndex(
        (candidate, at) => at < furthest && !isStepValid(candidate, at),
      )
    : -1
  const reach = firstInvalid < 0 ? furthest : firstInvalid
  const current = steps[index]
  const isLast = index === last

  const goToVisualStep = useCallback(
    (next: number) => {
      const target = clampIndex(next, last)
      setStep(target)
      setMax((previous) => Math.max(previous, target))
      if (target === last) setReturnToReview(false)
      setConfirmingReset(false)
      onNavigate?.()
    },
    [last, onNavigate],
  )

  const goToGroup = useCallback(
    (group: number) => {
      const first = steps.findIndex(
        (candidate) => candidate.groupStep === group,
      )
      if (first >= 0) goToVisualStep(first)
    },
    [goToVisualStep, steps],
  )

  const reviewing = returnToReview && !isLast
  const advance = useCallback(
    () => goToVisualStep(reviewing ? last : index + 1),
    [goToVisualStep, index, last, reviewing],
  )

  const editStep = useCallback(
    (title: string) => {
      const target = steps.findIndex((candidate) => candidate.title === title)
      if (target < 0) return
      goToVisualStep(target)
      setReturnToReview(true)
    },
    [goToVisualStep, steps],
  )

  const startOver = useCallback(() => {
    resetDraft?.()
    setStep(0)
    setMax(0)
    setReturnToReview(false)
    setResets((count) => count + 1)
    returnFocus.current = true
    setConfirmingReset(false)
    onNavigate?.()
  }, [onNavigate, resetDraft])

  const askReset = useCallback(() => setConfirmingReset(true), [])

  const keepEditing = useCallback(() => {
    returnFocus.current = true
    setConfirmingReset(false)
  }, [])

  // The confirmation replaces the action bar: move focus into it, and back
  // to the trigger when it closes, so keyboard users keep their place.
  useEffect(() => {
    if (confirmingReset) {
      keepEditingRef.current?.focus()
      return
    }
    if (!returnFocus.current) return
    returnFocus.current = false
    resetTriggerRef.current?.focus()
  }, [confirmingReset])

  // A new step starts at its top: bring the panel back if it scrolled away.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    const panel = panelRef.current
    // 72px: below the sticky app bar (64px) with a little air.
    if (!panel || panel.getBoundingClientRect().top >= 72) return
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  }, [index])

  // The stored draft remembers the form step, the sub-step and how far it
  // got. It also runs when the draft's copy changes, so a step form that
  // writes its own values back cannot leave a stale position behind.
  const componentStep = current?.componentStep
  const storedCurr = draft?.currStep
  const storedStep = draft?.visualStep
  const storedMax = draft?.maxVisualStep
  useEffect(() => {
    if (!setDraft || componentStep === undefined) return
    if (
      storedCurr === componentStep &&
      storedStep === index &&
      storedMax === furthest
    )
      return
    setDraft((previous) => ({
      ...previous,
      currStep: componentStep,
      visualStep: index,
      maxVisualStep: furthest,
    }))
  }, [
    componentStep,
    furthest,
    index,
    setDraft,
    storedCurr,
    storedMax,
    storedStep,
  ])

  const tabState = (at: number): SubTabState =>
    at === index
      ? 'current'
      : at < reach
        ? 'done'
        : at === reach || at < index
          ? 'reached'
          : 'next'

  const groupStatus = (group: number): FactoryGroupStatus => {
    if (current && group === current.groupStep) return 'active'
    const members = steps
      .map((candidate, at) => ({ candidate, at }))
      .filter(({ candidate }) => candidate.groupStep === group)
      .map(({ at }) => at)
    if (members.length === 0) return 'upcoming'
    const first = Math.min(...members)
    const lastMember = Math.max(...members)
    if (lastMember < reach) return 'complete'
    return first <= Math.max(reach, index) ? 'reached' : 'upcoming'
  }

  return {
    steps,
    index,
    current,
    isLast,
    reviewing,
    reach,
    resets,
    confirmingReset,
    tabState,
    groupStatus,
    goToVisualStep,
    goToGroup,
    advance,
    editStep,
    askReset,
    keepEditing,
    startOver,
    panelRef,
    resetTriggerRef,
    keepEditingRef,
  }
}

/* ---------- Layout ---------- */

const EASE_OUT = 'var(--ease-out)'

/** Stepper on top, the work below: one column at every width. */
export const FactoryWizardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
  min-width: 0;

  @media (max-width: 720px) {
    gap: 20px;
  }
`

/**
 * The step panel beside a sticky preview column; stacked below 1080px. Both
 * columns keep their own height: a short step ends right under its form,
 * with the action bar beneath it, whatever the preview's length.
 */
export const FactorySplit = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 392px;
  gap: 24px;
  align-items: start;

  @media (max-width: 1080px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
`

export const FactoryAside = styled.aside`
  position: sticky;
  top: calc(var(--app-bar-height) + 20px);
  min-width: 0;

  @media (max-width: 1080px) {
    position: static;
  }
`

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/* ---------- Horizontal stepper ---------- */

const Stepper = styled.nav`
  position: relative;
  width: 100%;
  min-width: 0;
`

const Track = styled.div<{ $count: number }>`
  position: absolute;
  top: 17px;
  left: calc(100% / ${({ $count }) => $count * 2});
  right: calc(100% / ${({ $count }) => $count * 2});
  height: 2px;
  border-radius: var(--radius-pill);
  background: var(--glass-border);

  @media (max-width: 720px) {
    top: 14px;
  }
`

/** How far the wizard has been: a quiet fill under the live one. */
const Reach = styled.span`
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--reach, 0) * 100%);
  border-radius: inherit;
  background: color-mix(in srgb, var(--color-primary) 30%, transparent);
  transition: width 900ms ${EASE_OUT};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Fill = styled.span`
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--progress, 0) * 100%);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--aurora-b), var(--color-primary));
  box-shadow: 0 0 14px color-mix(in srgb, var(--color-primary) 70%, transparent);
  transition: width 900ms ${EASE_OUT};

  /* The live head: the brightest point is where the wizard is now. */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -4px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--color-primary) 22%, transparent),
      0 0 16px var(--color-primary);
    transform: translateY(-50%);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Nodes = styled.ol<{ $count: number }>`
  position: relative;
  display: grid;
  grid-template-columns: repeat(${({ $count }) => $count}, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
`

const Node = styled.li`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
`

const nodeInner = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: center;

  @media (max-width: 720px) {
    gap: 8px;
  }
`

const NodeBody = styled.div`
  ${nodeInner}
`

const NodeButton = styled.button`
  ${nodeInner}
  cursor: pointer;
  border-radius: var(--radius);

  &:hover span[data-marker] {
    transform: translateY(-1px);
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--color-primary) 14%, transparent),
      0 8px 20px -10px var(--color-primary);
  }

  &:hover span[data-title] {
    color: var(--color-primary);
  }
`

const markerTone: Record<FactoryGroupStatus, ReturnType<typeof css>> = {
  upcoming: css`
    border-color: var(--glass-border);
    background: var(--color-surface);
    color: var(--color-faint);
  `,
  reached: css`
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    background: var(--color-surface);
    color: var(--color-primary);
  `,
  /* The step in hand: the primary glass and its lit edge, never a flat fill. */
  active: css`
    --edge-angle: 210deg;
    border-color: transparent;
    border-width: var(--edge-width, 1px);
    background: ${litEdgeBackground(ctaFill)};
    color: var(--cta-ink);
    box-shadow:
      inset 0 1px 0 var(--cta-highlight),
      0 0 0 6px var(--color-primary-soft),
      0 10px 28px -8px var(--cta-glow);
  `,
  complete: css`
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    background:
      linear-gradient(var(--color-primary-soft), var(--color-primary-soft)),
      var(--color-surface);
    color: var(--color-primary);
  `,
}

const Marker = styled.span<{ $status: FactoryGroupStatus }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid;
  border-radius: var(--radius-pill);
  font-size: 14px;
  line-height: 1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    background 320ms ${EASE_OUT},
    border-color 320ms ${EASE_OUT},
    box-shadow 320ms ${EASE_OUT},
    color 320ms ${EASE_OUT},
    transform var(--motion);
  ${({ $status }) => markerTone[$status]}

  @media (max-width: 720px) {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }
`

const NodeTitle = styled.span<{ $status: FactoryGroupStatus }>`
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: ${({ $status }) =>
    $status === 'upcoming' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: 15px;
  line-height: 20px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--motion);

  @media (max-width: 720px) {
    font-size: 13px;
    line-height: 18px;
  }
`

const NodeMeta = styled.span`
  display: block;
  max-width: 100%;
  margin-top: 4px;
  overflow: hidden;
  color: var(--color-faint);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 720px) {
    display: none;
  }
`

/** Where a bar ends: the group's position plus the share of its sub-steps passed. */
const progressOf = (
  group: number,
  groups: FactoryStepDescriptor[],
  subitem?: string,
): number => {
  if (groups.length < 2) return 1
  const step = groups[group - 1]
  const subIndex =
    step?.subitems && subitem ? step.subitems.indexOf(subitem) : -1
  const within =
    subIndex > 0 && step?.subitems ? subIndex / step.subitems.length : 0
  return Math.min(1, Math.max(0, (group - 1 + within) / (groups.length - 1)))
}

/**
 * The wizard's groups on one track. The live fill ends where the wizard is;
 * a quieter fill shows how far it has been, and every group up to there
 * (forward included) opens with a click.
 */
export const FactoryStepTimeline = ({
  groups,
  wizard,
}: {
  groups: FactoryStepDescriptor[]
  wizard: FactoryWizard
}) => {
  const { current } = wizard
  const furthest = wizard.steps[Math.max(wizard.reach, wizard.index)] ?? current
  const progress = progressOf(current.groupStep, groups, current.title)
  const reach = Math.max(
    progress,
    progressOf(furthest.groupStep, groups, furthest.title),
  )
  return (
    <Stepper aria-label="Steps">
      <Track $count={groups.length} aria-hidden>
        <Reach style={{ ['--reach' as string]: reach }} />
        <Fill style={{ ['--progress' as string]: progress }} />
      </Track>
      <Nodes $count={groups.length}>
        {groups.map((group, at) => {
          const groupNumber = at + 1
          const status = wizard.groupStatus(groupNumber)
          const clickable = status === 'complete' || status === 'reached'
          const body = (
            <>
              <Marker $status={status} data-marker aria-hidden>
                {status === 'complete' ? (
                  <CurateIcon name="check" size={16} />
                ) : (
                  groupNumber
                )}
              </Marker>
              <span style={{ minWidth: 0, maxWidth: '100%' }}>
                <NodeTitle $status={status} data-title>
                  {group.title}
                  {status === 'complete' && (
                    <VisuallyHidden> (done)</VisuallyHidden>
                  )}
                </NodeTitle>
                <NodeMeta>
                  {status === 'complete' ? 'Done' : group.description}
                </NodeMeta>
              </span>
            </>
          )

          return (
            <Node
              key={group.title}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              {clickable ? (
                <NodeButton
                  type="button"
                  aria-label={`${groupNumber < current.groupStep ? 'Go back to' : 'Go to'} ${group.title}`}
                  onClick={() => wizard.goToGroup(groupNumber)}
                >
                  {body}
                </NodeButton>
              ) : (
                <NodeBody>{body}</NodeBody>
              )}
            </Node>
          )
        })}
      </Nodes>
    </Stepper>
  )
}

/* ---------- Step panel ---------- */

/** The panel column. It keeps its own height (see FactorySplit). */
const PanelLift = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  ${reveal}
`

/** A column, so the action bar always follows the form. */
const StepPanel = styled(Surface)`
  display: flex;
  flex-direction: column;
  padding: 28px 32px 24px;
  scroll-margin-top: calc(var(--app-bar-height) + 24px);

  @media (max-width: 720px) {
    padding: 20px;
  }
`

const PanelTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 22px;

  /* On phones the stepper above names the group: the tabs get the row. */
  @media (max-width: 720px) {
    &[data-tabs='true'] > :first-child {
      display: none;
    }
  }
`

/** The step's form, above the action bar. */
const StepContent = styled.div`
  min-width: 0;
`

const SubTabs = styled.ol`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 720px) {
    gap: 2px;
  }
`

const SubTab = styled.button<{ $state: SubTabState }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-faint);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition:
    background var(--motion),
    border-color var(--motion),
    color var(--motion);

  @media (max-width: 720px) {
    gap: 5px;
    padding: 0 9px;
  }

  ${({ $state }) =>
    $state === 'current'
      ? css`
          /* The current step sits on the selectors' lit thumb. */
          position: relative;
          ${litThumb}
          color: var(--color-text);
        `
      : $state === 'done' || $state === 'reached'
        ? css`
            color: var(--color-muted);
            cursor: pointer;

            svg {
              color: var(--color-primary);
            }

            &:hover {
              background: var(--color-raised);
              color: var(--color-text);
            }
          `
        : css`
            cursor: default;
          `}
`

const ConfirmRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
`

/**
 * Previous; while an Edit from the review is open, phones drop it so
 * "Back to review" keeps the action bar on one row (the tabs still go back).
 */
const PreviousButton = styled(Button)<{ $wideOnly?: boolean }>`
  ${({ $wideOnly }) =>
    $wideOnly &&
    css`
      @media (max-width: 720px) {
        display: none;
      }
    `}
`

/**
 * The open step in one panel: the group's name with its sub-step tabs, the
 * step's form, then the action bar (Start over, Previous, and Next or "Back
 * to review", which submit the step's form so its schema runs first). Start
 * over asks first, in place of the bar.
 */
export const FactoryStepPanel = ({
  wizard,
  groups,
  formId,
  style,
  children,
}: {
  wizard: FactoryWizard
  groups: FactoryStepDescriptor[]
  /** The open step's form: Next and "Back to review" submit it. */
  formId: string
  style?: React.CSSProperties
  children: React.ReactNode
}) => {
  const confirmQuestionId = useId()
  const { current, index, steps, reviewing, isLast } = wizard
  const group = groups[current.groupStep - 1]
  const groupSteps = steps
    .map((candidate, at) => ({ ...candidate, at }))
    .filter((candidate) => candidate.groupStep === current.groupStep)
  const upcoming = steps[index + 1]
  const tabs = groupSteps.length > 1

  return (
    <PanelLift style={style}>
      <StepPanel $padding="none" ref={wizard.panelRef}>
        <PanelTop data-tabs={tabs}>
          <Label $tone="primary">
            {tabs ? group?.title : `${group?.title} · ${group?.description}`}
          </Label>
          {tabs && (
            <SubTabs aria-label={`${group?.title} steps`}>
              {groupSteps.map((candidate) => {
                const state = wizard.tabState(candidate.at)
                return (
                  <li key={candidate.title}>
                    <SubTab
                      type="button"
                      $state={state}
                      disabled={state === 'current' || state === 'next'}
                      aria-current={state === 'current' ? 'step' : undefined}
                      onClick={() => wizard.goToVisualStep(candidate.at)}
                    >
                      {state === 'done' && (
                        <CurateIcon name="check" size={12} />
                      )}
                      {candidate.title}
                    </SubTab>
                  </li>
                )
              })}
            </SubTabs>
          )}
        </PanelTop>

        <StepContent>{children}</StepContent>

        <FactoryActions $inPanel>
          {wizard.confirmingReset ? (
            <ConfirmRow
              role="alertdialog"
              aria-label="Start over?"
              aria-describedby={confirmQuestionId}
              onKeyDown={(event) => {
                if (event.key === 'Escape') wizard.keepEditing()
              }}
            >
              <Small $muted id={confirmQuestionId}>
                Clear every field and go back to the first step? Previous
                deployments are kept.
              </Small>
              <Row $gap={8} $wrap>
                <Button
                  ref={wizard.keepEditingRef}
                  type="button"
                  $variant="ghost"
                  $size="sm"
                  onClick={wizard.keepEditing}
                >
                  Keep editing
                </Button>
                <Button
                  type="button"
                  $variant="danger"
                  $size="sm"
                  onClick={wizard.startOver}
                >
                  Yes, start over
                </Button>
              </Row>
            </ConfirmRow>
          ) : (
            <>
              <Button
                ref={wizard.resetTriggerRef}
                type="button"
                $variant="ghost"
                $size="sm"
                onClick={wizard.askReset}
              >
                Start over
              </Button>
              <FactoryActionGroup>
                <PreviousButton
                  type="button"
                  $variant="secondary"
                  $wideOnly={reviewing}
                  disabled={index === 0}
                  onClick={() => wizard.goToVisualStep(index - 1)}
                >
                  Previous
                </PreviousButton>
                {reviewing ? (
                  <Button
                    type="submit"
                    form={formId}
                    $variant="primary"
                    title="Check this step, then return to the review"
                  >
                    Back to review
                    <CurateIcon name="submit" size={14} />
                  </Button>
                ) : (
                  !isLast && (
                    <Button
                      type="submit"
                      form={formId}
                      $variant="primary"
                      title={upcoming ? `Next: ${upcoming.title}` : undefined}
                    >
                      Next
                      <CurateIcon name="submit" size={14} />
                    </Button>
                  )
                )}
              </FactoryActionGroup>
            </>
          )}
        </FactoryActions>
      </StepPanel>
    </PanelLift>
  )
}

/**
 * Reset on the left, Previous and Next on the right; sticky at the bottom on
 * phones. `$inPanel` places it at the foot of a 20px-padded step panel, right
 * under the form (a hairline above it on desktop, the panel's own edges on
 * phones); without it the bar sits under the form at page level.
 */
export const FactoryActions = styled.div<{ $inPanel?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: ${({ $inPanel }) => ($inPanel ? '28px' : '16px')};
  ${({ $inPanel }) =>
    $inPanel &&
    css`
      flex: 0 0 auto;
      padding-top: 20px;
      border-top: 1px solid var(--glass-border);
    `}

  @media (max-width: 720px) {
    position: sticky;
    bottom: 0;
    z-index: 3;
    background: var(--color-surface);
    ${({ $inPanel }) =>
      $inPanel
        ? css`
            margin: 24px -20px -20px;
            padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
            border-radius: 0 0 var(--radius-lg) var(--radius-lg);
            box-shadow: 0 -12px 24px -16px var(--color-bg);
          `
        : css`
            margin: 16px calc(-1 * var(--horizontal-padding)) 0;
            padding: 12px var(--horizontal-padding)
              calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--glass-border);
          `}
  }
`

export const FactoryActionGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`
