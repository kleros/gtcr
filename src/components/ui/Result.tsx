import React from 'react'
import styled, { useTheme } from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle,
  faExclamationTriangle,
  faTimesCircle,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons'

type ResultStatus = 'success' | 'error' | 'warning' | 'info'

const statusIcons: Record<ResultStatus, typeof faCheckCircle> = {
  success: faCheckCircle,
  error: faTimesCircle,
  warning: faExclamationTriangle,
  info: faInfoCircle,
}

const Wrapper = styled.div`
  text-align: center;
  padding: 48px 32px;
`

const IconWrapper = styled.div<{ $color: string }>`
  font-size: 48px;
  margin-bottom: 24px;
  color: ${({ $color }) => $color};
`

const Title = styled.div`
  font-size: 24px;
  font-weight: 500;
  color: ${({ theme }) => theme.textPrimary || 'rgba(0, 0, 0, 0.85)'};
  margin-bottom: 8px;
`

const SubTitle = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.textSecondary || 'rgba(0, 0, 0, 0.45)'};
  margin-bottom: 24px;
`

const Extra = styled.div`
  margin-top: 24px;
`

interface ResultProps {
  status?: ResultStatus
  title?: React.ReactNode
  subTitle?: React.ReactNode
  extra?: React.ReactNode
  icon?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  [key: string]: unknown
}

const Result: React.FC<ResultProps> = ({
  status = 'info',
  title,
  subTitle,
  extra,
  icon,
  ...rest
}) => {
  const theme = useTheme()
  const statusColors: Record<ResultStatus, string> = {
    success: theme.successColor,
    error: theme.errorColor,
    warning: theme.warningColor,
    info: theme.infoColor,
  }
  const color = statusColors[status] || statusColors.info
  const statusIcon = statusIcons[status] || statusIcons.info

  return (
    <Wrapper {...rest}>
      <IconWrapper $color={color}>
        {icon || <FontAwesomeIcon icon={statusIcon} />}
      </IconWrapper>
      {title && <Title>{title}</Title>}
      {subTitle && <SubTitle>{subTitle}</SubTitle>}
      {extra && <Extra>{extra}</Extra>}
    </Wrapper>
  )
}

export default Result
