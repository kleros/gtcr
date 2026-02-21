import React from 'react'
import styled, { css, DefaultTheme } from 'styled-components'

const StepsWrapper = styled.div<{ $direction?: string }>`
  display: flex;
  ${({ $direction }) =>
    $direction === 'vertical'
      ? css`
          flex-direction: column;
        `
      : css`
          flex-direction: row;
          align-items: center;
        `}
  width: 100%;
`

const StepItem = styled.div<{ $isLast?: boolean; $direction?: string }>`
  display: flex;
  align-items: center;
  flex: ${({ $isLast }) => ($isLast ? '0 0 auto' : '1 1 0')};
  ${({ $direction }) =>
    $direction === 'vertical' &&
    css`
      flex-direction: row;
      min-height: 64px;
    `}
`

const getStatusColor = (status: string, theme: DefaultTheme) => {
  switch (status) {
    case 'finish':
      return theme.primaryColor
    case 'process':
      return theme.primaryColor
    case 'error':
      return theme.errorColor
    default:
      return theme.borderColor
  }
}

const StepCircle = styled.div<{ $status?: string }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  border: 2px solid ${({ $status, theme }) => getStatusColor($status || 'wait', theme)};
  transition: all 0.3s;

  ${({ $status, theme }) =>
    $status === 'process'
      ? css`
          background: ${theme.primaryColor};
          color: ${theme.textOnPrimary || '#fff'};
        `
      : $status === 'finish'
        ? css`
            background: ${theme.componentBackground};
            color: ${theme.primaryColor};
          `
        : $status === 'error'
          ? css`
              background: ${theme.componentBackground};
              color: ${theme.errorColor};
            `
          : css`
              background: ${theme.componentBackground};
              color: ${theme.textSecondary};
            `}
`

const StepTail = styled.div<{ $direction?: string; $done?: boolean }>`
  flex: 1;
  ${({ $direction }) =>
    $direction === 'vertical'
      ? css`
          width: 2px;
          min-height: 24px;
          margin: 4px 0;
        `
      : css`
          height: 2px;
          margin: 0 12px;
          min-width: 16px;
        `}
  background: ${({ $done, theme }) =>
    $done ? theme.primaryColor : theme.borderColor};
  transition: background 0.3s;
`

const StepTitle = styled.span<{ $status?: string }>`
  font-size: 14px;
  font-weight: 500;
  margin-left: 8px;
  white-space: nowrap;
  color: ${({ $status, theme }) =>
    $status === 'wait' ? theme.textSecondary : theme.textPrimary};
  transition: color 0.3s;
`

const StepDescription = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.textSecondary};
  margin-top: 2px;
  max-width: 140px;
`

const CheckIcon = () => (
  <svg
    viewBox="64 64 896 896"
    width="14"
    height="14"
    fill="currentColor"
  >
    <path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z" />
  </svg>
)

interface StepProps {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  status?: string
  $index?: number
  $direction?: string
  $isLast?: boolean
}

const Step: React.FC<StepProps> = ({ title, description, icon, status = 'wait', $index = 0, $direction, $isLast }) => {
  if ($direction === 'vertical') {
    return (
      <StepItem $direction={$direction} $isLast={$isLast}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <StepCircle $status={status}>
            {icon || (status === 'finish' ? <CheckIcon /> : $index + 1)}
          </StepCircle>
          {!$isLast && <StepTail $direction={$direction} $done={status === 'finish'} />}
        </div>
        <div style={{ marginLeft: 12, paddingBottom: 16 }}>
          <StepTitle $status={status} style={{ marginLeft: 0 }}>{title}</StepTitle>
          {description && <StepDescription>{description}</StepDescription>}
        </div>
      </StepItem>
    )
  }

  return (
    <StepItem $isLast={$isLast}>
      <StepCircle $status={status}>
        {icon || (status === 'finish' ? <CheckIcon /> : $index + 1)}
      </StepCircle>
      <StepTitle $status={status}>{title}</StepTitle>
      {!$isLast && <StepTail $done={status === 'finish'} />}
    </StepItem>
  )
}

Step.displayName = 'Steps.Step'

interface StepsProps {
  current?: number
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  direction?: string
}

interface StepsComponent extends React.FC<StepsProps> {
  Step: React.FC<StepProps>
}

const Steps: StepsComponent = ({
  current = 0,
  children,
  style,
  className,
  direction = 'horizontal'
}) => {
  const items = React.Children.toArray(children)

  return (
    <StepsWrapper
      $direction={direction}
      style={style}
      className={`ui-steps${className ? ` ${className}` : ''}`}
    >
      {items.map((child, index) => {
        const element = child as React.ReactElement
        let status = element.props.status
        if (!status) {
          if (index < current) status = 'finish'
          else if (index === current) status = 'process'
          else status = 'wait'
        }

        return React.cloneElement(element, {
          key: index,
          $index: index,
          $direction: direction,
          $isLast: index === items.length - 1,
          status
        })
      })}
    </StepsWrapper>
  )
}

Steps.Step = Step

export { Step }
export default Steps
