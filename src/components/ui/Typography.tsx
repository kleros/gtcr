import React, { useCallback } from 'react'
import styled, { css } from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const typeColorMap: Record<string, (props: { theme: any }) => string> = {
  secondary: ({ theme }) => theme.textSecondary,
  warning: ({ theme }) => theme.warningColor,
  danger: ({ theme }) => theme.errorColor
}

const getTypeColor = ({ textType, theme }: { textType?: string; theme: any }): string => {
  const resolver = typeColorMap[textType || '']
  return resolver ? resolver({ theme }) : theme.textPrimary
}

const ellipsisMixin = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

interface StyledTextProps {
  textType?: string
  $strong?: boolean
  $ellipsis?: boolean
}

const StyledText = styled.span<StyledTextProps>`
  color: ${getTypeColor};
  ${({ $strong }) =>
    $strong &&
    css`
      font-weight: 600;
    `}
  ${({ $ellipsis }) => $ellipsis && ellipsisMixin}
`

const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.linkColor};
  padding: 0 4px;
  margin-left: 4px;
  font-size: inherit;
  opacity: 0.65;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`

interface StyledTitleProps {
  $level: number
}

const StyledTitle = styled.h1<StyledTitleProps>`
  color: ${({ theme }) => theme.textPrimary};
  font-weight: 600;
  margin-bottom: 0.5em;
  margin-top: 0;

  ${({ $level }) => {
    const sizes: Record<number, string> = {
      1: '38px',
      2: '30px',
      3: '24px',
      4: '20px',
      5: '16px'
    }
    return css`
      font-size: ${sizes[$level] || sizes[1]};
    `
  }}
`

interface StyledParagraphProps {
  textType?: string
  $ellipsis?: boolean
}

const StyledParagraph = styled.p<StyledParagraphProps>`
  color: ${getTypeColor};
  margin-bottom: 1em;
  ${({ $ellipsis }) => $ellipsis && ellipsisMixin}
`

interface TextProps {
  type?: string
  copyable?: boolean
  ellipsis?: boolean
  strong?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}

const Text: React.FC<TextProps> = ({ type, copyable, ellipsis, strong, children, style, className, ...rest }) => {
  const handleCopy = useCallback(() => {
    const text = typeof children === 'string' ? children : ''
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
  }, [children])

  return (
    <StyledText
      textType={type}
      $strong={strong}
      $ellipsis={ellipsis}
      style={style}
      className={className}
      {...rest}
    >
      {children}
      {copyable && (
        <CopyButton onClick={handleCopy} title="Copy">
          <FontAwesomeIcon icon="copy" size="sm" />
        </CopyButton>
      )}
    </StyledText>
  )
}

interface TitleProps {
  level?: 1 | 2 | 3 | 4 | 5
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}

const Title: React.FC<TitleProps> = ({ level = 1, children, style, className, ...rest }) => {
  const tag = `h${Math.min(Math.max(level, 1), 5)}` as keyof JSX.IntrinsicElements
  return (
    <StyledTitle
      as={tag}
      $level={level}
      style={style}
      className={className}
      {...rest}
    >
      {children}
    </StyledTitle>
  )
}

interface ParagraphProps {
  type?: string
  ellipsis?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}

const Paragraph: React.FC<ParagraphProps> = ({ type, ellipsis, children, style, className, ...rest }) => (
  <StyledParagraph
    textType={type}
    $ellipsis={ellipsis}
    style={style}
    className={className}
    {...rest}
  >
    {children}
  </StyledParagraph>
)

const Typography = { Text, Title, Paragraph }

export default Typography
