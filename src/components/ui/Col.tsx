import React from 'react'
import styled, { css } from 'styled-components'

const BREAKPOINTS: Record<string, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
}

type ResponsiveValue = number | { span?: number; offset?: number }

const getResponsiveStyles = (
  breakpoint: string,
  value: ResponsiveValue | undefined,
) => {
  if (value === undefined || value === null) return ''

  const bp = BREAKPOINTS[breakpoint]
  let span: number | undefined
  let offset: number | undefined

  if (typeof value === 'number') {
    span = value
    offset = undefined
  } else if (typeof value === 'object') {
    span = value.span
    offset = value.offset
  } else return ''

  const styles: string[] = []

  if (span === 0) styles.push('display: none;')
  else {
    styles.push('display: block;')
    if (span !== undefined) {
      const width = (span / 24) * 100
      styles.push(`flex: 0 0 ${width}%;`)
      styles.push(`max-width: ${width}%;`)
    }
  }

  if (offset !== undefined && offset > 0) {
    const ml = (offset / 24) * 100
    styles.push(`margin-left: ${ml}%;`)
  }

  if (bp === 0)
    return css`
      ${styles.join('\n')}
    `

  return css`
    @media (min-width: ${bp}px) {
      ${styles.join('\n')}
    }
  `
}

interface ColWrapperProps {
  $span?: number
  $offset?: number
  $gutter?: number
  $xs?: ResponsiveValue
  $sm?: ResponsiveValue
  $md?: ResponsiveValue
  $lg?: ResponsiveValue
  $xl?: ResponsiveValue
  $xxl?: ResponsiveValue
}

const ColWrapper = styled.div<ColWrapperProps>`
  position: relative;
  box-sizing: border-box;
  min-height: 1px;

  /* Base span */
  ${({ $span }) => {
    if ($span === undefined) return ''
    if ($span === 0) return 'display: none;'
    const width = ($span / 24) * 100
    return css`
      flex: 0 0 ${width}%;
      max-width: ${width}%;
    `
  }}

  /* Base offset */
  ${({ $offset }) => {
    if (!$offset) return ''
    const ml = ($offset / 24) * 100
    return css`
      margin-left: ${ml}%;
    `
  }}

  /* Gutter from Row */
  ${({ $gutter }) => {
    if (!$gutter) return ''
    const half = $gutter / 2
    return css`
      padding-left: ${half}px;
      padding-right: ${half}px;
    `
  }}

  /* Responsive breakpoints */
  ${({ $xs }) => getResponsiveStyles('xs', $xs)}
  ${({ $sm }) => getResponsiveStyles('sm', $sm)}
  ${({ $md }) => getResponsiveStyles('md', $md)}
  ${({ $lg }) => getResponsiveStyles('lg', $lg)}
  ${({ $xl }) => getResponsiveStyles('xl', $xl)}
  ${({ $xxl }) => getResponsiveStyles('xxl', $xxl)}
`

interface ColProps {
  span?: number
  offset?: number
  xs?: ResponsiveValue
  sm?: ResponsiveValue
  md?: ResponsiveValue
  lg?: ResponsiveValue
  xl?: ResponsiveValue
  xxl?: ResponsiveValue
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  $gutter?: number
}

const Col: React.FC<ColProps> = ({
  span,
  offset,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  children,
  style,
  className,
  $gutter,
}) => (
  <ColWrapper
    $span={span}
    $offset={offset}
    $xs={xs}
    $sm={sm}
    $md={md}
    $lg={lg}
    $xl={xl}
    $xxl={xxl}
    $gutter={$gutter}
    style={style}
    className={`ui-col${className ? ` ${className}` : ''}`}
  >
    {children}
  </ColWrapper>
)

export default Col
