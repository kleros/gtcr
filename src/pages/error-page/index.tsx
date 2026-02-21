import React from 'react'
import styled from 'styled-components'
import Acropolis from 'assets/images/acropolis.svg?react'

const StyledDiv = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`
const StyledAcropolis = styled(Acropolis)`
  height: auto;
  width: 100%;

  /* Dark mode: use CSS filter for maintainable theming */
  ${({ theme }) =>
    theme.name === 'dark' &&
    `
    filter: brightness(0.4) saturate(0.8) hue-rotate(-10deg);
  `}
`
const StyledInfoDiv = styled.div`
  flex: 1;
  padding: 0 var(--horizontal-padding) 62px;
  text-align: center;
`
const Styled404Div = styled.div`
  font-size: 88px;
  font-weight: bold;
  line-height: 112px;
  color: ${({ theme }) => theme.tertiaryColor};
`
const StyledMessageLine1 = styled.div`
  font-size: 28px;
  font-weight: bold;
`
const StyledMessageLine2 = styled.div`
  font-size: 24px;
`
const StyledMessageLine3 = styled.div`
  font-size: 16px;
  margin-top: 25px;
`
interface ErrorPageProps {
  code?: string | null
  title?: string | null
  message?: string | null
  tip?: string | React.ReactNode | null
}

const ErrorPage = ({ code, title, message, tip }: ErrorPageProps) => (
  <StyledDiv>
    <StyledAcropolis />
    <StyledInfoDiv className="quaternary-background theme-background">
      <Styled404Div>{code || '404'}</Styled404Div>
      <StyledMessageLine1 className="ternary-color theme-color">
        {title}
      </StyledMessageLine1>
      <StyledMessageLine2 className="ternary-color theme-color">
        {message || 'The gods could not find the page you are looking for!'}
      </StyledMessageLine2>
      <StyledMessageLine3 className="ternary-color theme-color">
        {tip}
      </StyledMessageLine3>
    </StyledInfoDiv>
  </StyledDiv>
)


export default ErrorPage
