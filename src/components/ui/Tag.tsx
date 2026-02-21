import React, { useState, useCallback } from 'react'
import styled, { css } from 'styled-components'

const StyledTag = styled.span<{ $color?: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 22px;
  font-size: 12px;
  line-height: 20px;
  border-radius: 4px;
  white-space: nowrap;
  transition: all 0.2s;
  border: 1px solid;
  gap: 4px;

  ${({ $color, theme }) =>
    $color
      ? css`
          background: ${$color};
          border-color: ${$color};
          color: #fff;
        `
      : css`
          background: ${theme.elevatedBackground};
          border-color: ${theme.borderColor};
          color: ${theme.textPrimary};
        `}
`

const CloseButton = styled.span`
  cursor: pointer;
  font-size: 10px;
  margin-left: 2px;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`

const CheckableTagStyled = styled.span<{ $checked?: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 22px;
  font-size: 12px;
  line-height: 20px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
  user-select: none;

  ${({ $checked, theme }) =>
    $checked
      ? css`
          background: ${theme.primaryColor};
          border-color: ${theme.primaryColor};
          color: ${theme.textOnPrimary || '#fff'};
        `
      : css`
          background: ${theme.elevatedBackground};
          border-color: ${theme.borderColor};
          color: ${theme.textPrimary};

          &:hover {
            color: ${theme.primaryColor};
            border-color: ${theme.primaryColor};
          }
        `}
`

interface TagProps {
  color?: string
  closable?: boolean
  onClose?: (e: React.MouseEvent) => void
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

interface CheckableTagProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

interface TagComponent extends React.FC<TagProps> {
  CheckableTag: React.FC<CheckableTagProps>
}

const Tag: TagComponent = ({ color, closable = false, onClose, children, style, className }) => {
  const [visible, setVisible] = useState(true)

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setVisible(false)
      if (onClose) onClose(e)
    },
    [onClose]
  )

  if (!visible) return null

  return (
    <StyledTag
      $color={color}
      style={style}
      className={`ui-tag${className ? ` ${className}` : ''}`}
    >
      {children}
      {closable && (
        <CloseButton onClick={handleClose} role="button" aria-label="Close">
          &#10005;
        </CloseButton>
      )}
    </StyledTag>
  )
}

const CheckableTag: React.FC<CheckableTagProps> = ({ checked, onChange, children, style, className }) => {
  const handleClick = useCallback(() => {
    if (onChange) onChange(!checked)
  }, [checked, onChange])

  return (
    <CheckableTagStyled
      $checked={checked}
      onClick={handleClick}
      style={style}
      className={`ui-tag-checkable${className ? ` ${className}` : ''}`}
    >
      {children}
    </CheckableTagStyled>
  )
}

CheckableTag.displayName = 'Tag.CheckableTag'
Tag.CheckableTag = CheckableTag

export default Tag
