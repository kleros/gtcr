import React from 'react'
import styled from 'styled-components'
import { formatDurationLong } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import { Label, Small, Subheading } from 'components/curate/primitives'
import {
  formatAmount,
  formatEther,
  groupThousands,
} from 'components/curate/item-standard-format'
import { PolicyButton } from '../policy-button'

/*
 * The step scaffold of the connected (badges) list's dialog: what is being
 * added and for which list, the deposit, the steps rail and the way to the
 * listing policy. The steps are the dialog's own.
 */

const Flow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const FlowHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--glass-border);
`

const DepositBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;

  @media (max-width: 560px) {
    align-items: flex-start;
    text-align: left;
  }
`

const DepositFigure = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 30px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: var(--fs-small);
    font-weight: 500;
    letter-spacing: 0;
  }
`

const FlowBody = styled.div`
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 24px 32px;
  align-items: start;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`

const StepsRail = styled.ol`
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 860px) {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px 20px;
  }
`

const StepItem = styled.li<{ $active: boolean }>`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  color: ${({ $active }) =>
    $active ? 'var(--color-text)' : 'var(--color-muted)'};
`

const StepNumber = styled.span<{ $active: boolean; $done: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid
    ${({ $active, $done }) =>
      $active || $done ? 'var(--color-primary)' : 'var(--color-border-strong)'};
  border-radius: var(--radius-pill);
  background: ${({ $done }) =>
    $done ? 'var(--color-primary-soft)' : 'transparent'};
  color: ${({ $active, $done }) =>
    $active || $done ? 'var(--color-primary)' : 'var(--color-muted)'};
  font-size: var(--fs-label);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    border-color var(--motion),
    background var(--motion),
    color var(--motion);
`

const StepText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-top: 2px;

  strong {
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 600;
  }

  @media (max-width: 860px) {
    small {
      display: none;
    }
  }
`

const FlowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
`

const PolicyNote = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
`

export const SubmissionNavigation = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 520px) {
    > * {
      flex: 1 1 auto;
    }
  }
`

const DEFAULT_STEPS = [
  'Fill in the fields',
  'Read the policy',
  'Review and confirm',
]

export const SubmissionFlowScaffold = ({
  tcrTitle,
  itemName,
  nativeCurrency,
  submissionDeposit,
  challengePeriodDuration,
  fileURI,
  tcrAddress,
  activeStep = 0,
  fieldLabels = [],
  steps = DEFAULT_STEPS,
  navigation,
  children,
}: {
  tcrTitle?: string
  itemName?: string
  nativeCurrency: string
  submissionDeposit: { toString: () => string }
  challengePeriodDuration?: { toNumber: () => number }
  fileURI?: string
  /** The list submitted to, whose policy this is (default: the URL's). */
  tcrAddress?: string
  activeStep?: number
  fieldLabels?: string[]
  steps?: string[]
  navigation?: React.ReactNode
  children: React.ReactNode
}) => {
  const period = challengePeriodDuration
    ? formatDurationLong(challengePeriodDuration.toNumber())
    : undefined
  return (
    <Flow>
      <FlowHeader>
        <div>
          <Label $tone="faint">{`New ${itemName || 'entry'} for`}</Label>
          <Subheading>{tcrTitle || 'this list'}</Subheading>
        </div>
        <DepositBlock>
          <Label $tone="faint">Deposit</Label>
          <DepositFigure
            title={formatAmount(submissionDeposit.toString(), nativeCurrency)}
          >
            {groupThousands(formatEther(submissionDeposit.toString()))}
            <small>{nativeCurrency}</small>
          </DepositFigure>
          <Small $muted>
            {`Back in full if your ${itemName || 'entry'} follows the policy${
              period ? ` · challenge period ${period}` : ''
            }`}
          </Small>
        </DepositBlock>
      </FlowHeader>
      <FlowBody>
        <StepsRail aria-label="Steps">
          {steps.map((step, index) => (
            <StepItem key={step} $active={index === activeStep}>
              <StepNumber
                $active={index === activeStep}
                $done={index < activeStep}
                aria-hidden
              >
                {index < activeStep ? (
                  <CurateIcon name="check" size={12} />
                ) : (
                  index + 1
                )}
              </StepNumber>
              <StepText
                aria-current={index === activeStep ? 'step' : undefined}
              >
                <strong>{step}</strong>
                {index === 0 &&
                  fieldLabels.slice(0, 4).map((label) => (
                    <Small key={label} $muted>
                      {label}
                    </Small>
                  ))}
              </StepText>
            </StepItem>
          ))}
        </StepsRail>
        <FlowMain>
          {children}
          {navigation}
          {/* The policy step opens the policy itself; the others keep a way
              to it. */}
          {!/policy/i.test(steps[activeStep] ?? '') && (
            <PolicyNote>
              <PolicyButton fileURI={fileURI} tcrAddress={tcrAddress}>
                <CurateIcon name="policy" size={14} />
                Read the listing policy
              </PolicyButton>
            </PolicyNote>
          )}
        </FlowMain>
      </FlowBody>
    </Flow>
  )
}
