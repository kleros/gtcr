import { ReactComponent as Acropolis } from '../../assets/images/acropolis.svg'
import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'

const StyledDiv = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`
const StyledAcropolis = styled(Acropolis)`
  height: auto;
  width: 100%;
`
const StyledInfoDiv = styled.div`
  flex: 1;
  padding: 0 9.375vw 62px;
  text-align: center;
`
const Styled404Div = styled.div`
  font-size: 88px;
  font-weight: bold;
  line-height: 112px;
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
const ErrorPage = ({ code, title, message, tip }) => (
  <StyledDiv>
    <StyledAcropolis />
    <StyledInfoDiv className="quaternary-background theme-background">
      <Styled404Div className="primary-color theme-color">
        {code || '404'}
      </Styled404Div>
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

ErrorPage.propTypes = {
  code: PropTypes.string,
  title: PropTypes.string,
  message: PropTypes.string,
  tip: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
}

ErrorPage.defaultProps = {
  code: null,
  title: null,
  message: null,
  tip: null
}

export default ErrorPage
