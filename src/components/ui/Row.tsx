import React from 'react'
import styled, { css } from 'styled-components'

const justifyMap: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  'space-between': 'space-between',
  'space-around': 'space-around'
}

const alignMap: Record<string, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
}

interface RowWrapperProps {
  $justify?: string
  $align?: string
  $gutter?: number
}

const RowWrapper = styled.div<RowWrapperProps>`
  display: flex;
  flex-flow: row wrap;
  ${({ $justify }) =>
    $justify &&
    css`
      justify-content: ${justifyMap[$justify] || $justify};
    `}
  ${({ $align }) =>
    $align &&
    css`
      align-items: ${alignMap[$align] || $align};
    `}
  ${({ $gutter }) => {
    if (!$gutter) return ''
    const g = typeof $gutter === 'number' ? $gutter : 0
    if (g > 0) {
      const half = g / 2
      return css`
        margin-left: -${half}px;
        margin-right: -${half}px;
      `
    }
    return ''
  }}
`

interface RowProps {
  type?: string
  justify?: string
  align?: string
  gutter?: number | object
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Row: React.FC<RowProps> = ({
  type,
  justify,
  align,
  gutter = 0,
  children,
  style,
  className
}) => {
  const gutterValue = typeof gutter === 'object' ? 0 : gutter

  const childrenWithGutter =
    gutterValue > 0
      ? React.Children.map(children, child => {
          if (!child) return child
          return React.cloneElement(child as React.ReactElement<any>, { $gutter: gutterValue })
        })
      : children

  return (
    <RowWrapper
      $justify={justify}
      $align={align}
      $gutter={gutterValue}
      style={style}
      className={`ui-row${className ? ` ${className}` : ''}`}
    >
      {childrenWithGutter}
    </RowWrapper>
  )
}

export default Row
