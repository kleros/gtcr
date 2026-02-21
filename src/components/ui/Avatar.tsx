import React from 'react'
import styled, { css } from 'styled-components'

const SIZES: Record<string, number> = {
  small: 24,
  default: 32,
  large: 40
}

const resolveSize = (size: number | string): number => {
  if (typeof size === 'number') return size
  return SIZES[size] || SIZES.default
}

interface AvatarWrapperProps {
  $size: number
  $shape: string
}

const AvatarWrapper = styled.span<AvatarWrapperProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: ${({ theme }) => theme.primaryColor};
  color: #fff;
  white-space: nowrap;
  vertical-align: middle;

  ${({ $size }) => css`
    width: ${$size}px;
    height: ${$size}px;
    font-size: ${$size * 0.45}px;
    line-height: ${$size}px;
  `}

  ${({ $shape }) =>
    $shape === 'square'
      ? css`
          border-radius: 4px;
        `
      : css`
          border-radius: 50%;
        `}
`

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

interface AvatarProps {
  shape?: 'circle' | 'square'
  size?: 'small' | 'default' | 'large' | number
  icon?: React.ReactNode
  src?: string
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

const Avatar: React.FC<AvatarProps> = ({
  shape = 'circle',
  size = 'default',
  icon,
  src,
  style,
  className,
  children
}) => {
  const px = resolveSize(size)

  return (
    <AvatarWrapper
      $size={px}
      $shape={shape}
      style={style}
      className={className}
    >
      {src ? (
        <AvatarImg src={src} alt="" />
      ) : icon ? (
        icon
      ) : (
        children
      )}
    </AvatarWrapper>
  )
}

export default Avatar
