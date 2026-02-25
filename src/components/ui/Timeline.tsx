import React from 'react'
import styled from 'styled-components'

const TimelineWrapper = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
`

const TimelineItemWrapper = styled.li`
  position: relative;
  padding: 0 0 20px 24px;

  &:last-child {
    padding-bottom: 0;
  }
`

const TimelineTail = styled.div`
  position: absolute;
  top: 10px;
  left: 5px;
  width: 2px;
  height: calc(100% - 10px);
  background: ${({ theme }) => theme.borderColor};

  ${TimelineItemWrapper}:last-child & {
    display: none;
  }
`

const TimelineDot = styled.div<{ $color?: string; $custom?: boolean }>`
  position: absolute;
  left: 0;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${({ $color, theme }) => $color || theme.primaryColor};
  background: ${({ theme }) => theme.componentBackground};

  /* If a custom dot node is provided, override styles */
  ${({ $custom, theme }) =>
    $custom &&
    `
    width: auto;
    height: auto;
    border: none;
    border-radius: 0;
    background: ${theme.componentBackground};
    transform: translateX(-50%);
    left: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${theme.timelineDotColor};
  `}
`

const TimelineContent = styled.div`
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  line-height: 1.5;
  min-height: 20px;
`

interface TimelineItemProps {
  dot?: React.ReactNode
  color?: string
  children?: React.ReactNode
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  dot,
  color,
  children,
}) => (
  <TimelineItemWrapper className="ui-timeline-item">
    <TimelineTail />
    <TimelineDot $color={color} $custom={!!dot}>
      {dot || null}
    </TimelineDot>
    <TimelineContent>{children}</TimelineContent>
  </TimelineItemWrapper>
)

TimelineItem.displayName = 'Timeline.Item'

interface TimelineProps {
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

interface TimelineComponent extends React.FC<TimelineProps> {
  Item: React.FC<TimelineItemProps>
}

const Timeline: TimelineComponent = ({ children, style, className }) => (
  <TimelineWrapper
    style={style}
    className={`ui-timeline${className ? ` ${className}` : ''}`}
  >
    {children}
  </TimelineWrapper>
)

Timeline.Item = TimelineItem

export default Timeline
