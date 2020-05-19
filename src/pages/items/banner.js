import { Typography, Skeleton, Button, Icon } from 'antd'
import { Link } from 'react-router-dom'
import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { ZERO_ADDRESS, capitalizeFirstLetter } from '../../utils/string'

const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
`

const StyledButton = styled(Button)`
  margin-top: 6px;
`

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
`

const Banner = ({
  metadata,
  requestWeb3Auth,
  setSubmissionFormOpen,
  connectedTCRAddr
}) => {
  const { itemName, tcrTitle, tcrDescription } = metadata || {}

  return (
    <StyledBanner>
      <StyledHeader>
        {metadata ? (
          <Typography.Title ellipsis style={{ marginBottom: '0' }}>
            {tcrTitle}
          </Typography.Title>
        ) : (
          <Skeleton active paragraph={false} title={{ width: 100 }} />
        )}
        <StyledButton
          type="primary"
          size="large"
          onClick={() => requestWeb3Auth(() => setSubmissionFormOpen(true))}
        >
          Submit {itemName || 'Item'}
          <Icon type="plus-circle" />
        </StyledButton>
      </StyledHeader>
      {metadata ? (
        <Typography.Text ellipsis type="secondary" style={{ maxWidth: '100%' }}>
          {capitalizeFirstLetter(tcrDescription)}
        </Typography.Text>
      ) : (
        <Skeleton active paragraph={{ rows: 1, width: 150 }} title={false} />
      )}
      {connectedTCRAddr && connectedTCRAddr !== ZERO_ADDRESS && (
        <>
          <br />
          <Typography.Text
            ellipsis
            type="secondary"
            style={{ maxWidth: '100%', textDecoration: 'underline' }}
          >
            <Link
              to={`/tcr/${connectedTCRAddr}`}
              style={{ color: '#4d00b473' }}
            >
              View Badges TCR
            </Link>
          </Typography.Text>
        </>
      )}
    </StyledBanner>
  )
}

Banner.propTypes = {
  metadata: PropTypes.shape({
    itemName: PropTypes.string.isRequired,
    tcrTitle: PropTypes.string.isRequired,
    tcrDescription: PropTypes.string.isRequired,
    logoURI: PropTypes.string.isRequired
  }),
  requestWeb3Auth: PropTypes.func.isRequired,
  setSubmissionFormOpen: PropTypes.func.isRequired,
  connectedTCRAddr: PropTypes.string
}

Banner.defaultProps = {
  metadata: null,
  connectedTCRAddr: null
}

export default Banner
