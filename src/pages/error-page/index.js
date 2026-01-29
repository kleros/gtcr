import React from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { ReactComponent as Acropolis } from 'assets/images/acropolis.svg'

const StyledDiv = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`
const StyledAcropolis = styled(Acropolis)`
  height: auto;
  width: 100%;

  /* Dark mode: adjust colors */
  ${({ theme }) =>
    theme.name === 'dark' &&
    `
    /* Background purple -> darker */
    path[fill="#4D00B4"],
    path[fill="#4d00b4"] {
      fill: #1a0a2e;
    }

    /* Light mountain areas -> darker purple tones */
    path[fill="#EAE1F2"],
    path[fill="#eae1f2"] {
      fill: #2d2840;
    }
    path[fill="#CEC2DA"],
    path[fill="#cec2da"] {
      fill: #252035;
    }
    path[fill="#C7B9D4"],
    path[fill="#c7b9d4"] {
      fill: #1e1a28;
    }
    path[fill="#DFD1EC"],
    path[fill="#dfd1ec"] {
      fill: #3d3550;
    }
    path[fill="#EAD6FE"],
    path[fill="#ead6fe"] {
      fill: #3a3055;
    }

    /* Accent purple -> brighter for dark mode */
    path[fill="#9013FE"],
    path[fill="#9013fe"] {
      fill: #9b5fff;
    }

    /* White highlights -> muted */
    path[fill="white"] {
      fill: rgba(255, 255, 255, 0.15);
    }

    /* Gradient stop colors for dark mode */
    stop[stop-color="white"] {
      stop-color: rgba(155, 95, 255, 0.3);
    }
    stop[stop-color="#9013FE"],
    stop[stop-color="#9013fe"] {
      stop-color: #6c4dc4;
    }
  `}
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
