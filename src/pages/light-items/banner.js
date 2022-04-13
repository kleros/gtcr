import { Typography, Skeleton, Button, Icon } from 'antd'
import { Link } from 'react-router-dom'
import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import useWindowDimensions from 'hooks/window-dimensions'
import { useWeb3Context } from 'web3-react'
import useNetworkEnvVariable from 'utils/network-env'

const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
  display: flex;
  justify-content: space-between;
`

const StyledButton = styled(Button)`
  text-transform: capitalize;
  margin-top: 6px;
`

const TCRInfoColumn = styled.div`
  display: flex;
  flex-direction: column;

  @media (max-width: 500px) {
    font-size: 1em;
    max-width: 230px;
  }
`

const StyledImage = styled.img`
  object-fit: contain;
  height: 50px;
  width: 50px;
  padding: 0 0 5px 5px;
`

const TCRTitle = styled.div`
  display: flex;
`

const ActionCol = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
`

const TCRLogo = ({ logoURI }) =>
  logoURI && (
    <StyledImage
      src={`${process.env.REACT_APP_IPFS_GATEWAY}${logoURI}`}
      alt="item"
    />
  )

TCRLogo.propTypes = {
  logoURI: PropTypes.string
}

TCRLogo.defaultProps = {
  logoURI: null
}

const Banner = ({
  metaEvidence,
  requestWeb3Auth,
  setSubmissionFormOpen,
  connectedTCRAddr,
  tcrAddress
}) => {
  const { networkId } = useWeb3Context()
  const { width } = useWindowDimensions()
  const defaultTCRAddress = useNetworkEnvVariable(
    'REACT_APP_DEFAULT_TCR_ADDRESSES',
    networkId
  )
  const { metadata, fileURI } = metaEvidence || {}
  const { itemName, tcrTitle, tcrDescription, logoURI, relTcrDisabled } =
    metadata || {}

  const normalizedDescription = tcrDescription
    ? tcrDescription[tcrDescription.length - 1] === '.'
      ? tcrDescription
      : `${tcrDescription}.`
    : ''

  return (
    <StyledBanner>
      <TCRInfoColumn id="tcr-info-column">
        {metadata ? (
          <>
            <TCRTitle>
              <Typography.Title ellipsis style={{ marginBottom: '0' }}>
                {tcrTitle}
              </Typography.Title>
              {defaultTCRAddress && tcrAddress !== defaultTCRAddress && (
                <TCRLogo logoURI={logoURI} />
              )}
            </TCRTitle>
            <Typography.Text
              ellipsis
              type="secondary"
              style={{ maxWidth: '100%' }}
            >
              {capitalizeFirstLetter(normalizedDescription)}
            </Typography.Text>
          </>
        ) : (
          <>
            <Skeleton active paragraph={false} title={{ width: 100 }} />
            <Skeleton
              active
              paragraph={{ rows: 1, width: 150 }}
              title={false}
            />
          </>
        )}
        {connectedTCRAddr &&
          connectedTCRAddr !== ZERO_ADDRESS &&
          !relTcrDisabled && (
            <>
              <Typography.Text
                ellipsis
                type="secondary"
                style={{ maxWidth: '100%', textDecoration: 'underline' }}
              >
                <Link
                  to={`/tcr/${connectedTCRAddr}`}
                  style={{ color: '#4d00b473' }}
                >
                  View Badges list
                </Link>
              </Typography.Text>
            </>
          )}
      </TCRInfoColumn>
      <ActionCol>
        <StyledButton
          type="primary"
          size="large"
          onClick={() => requestWeb3Auth(() => setSubmissionFormOpen(true))}
          id="submit-item-button"
        >
          {width > 450 && `Submit ${capitalizeFirstLetter(itemName) || 'Item'}`}
          <Icon type="plus-circle" />
        </StyledButton>
        <Typography.Text
          ellipsis
          type="secondary"
          style={{
            maxWidth: '100%',
            textDecoration: 'underline',
            marginTop: '12px'
          }}
          id="policy-link"
        >
          <a
            href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}
            style={{ textDecoration: 'underline', color: '#4d00b473' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            {width > 450 ? 'View Listing Policies' : 'Policies'}
          </a>
        </Typography.Text>
      </ActionCol>
    </StyledBanner>
  )
}

Banner.propTypes = {
  metaEvidence: PropTypes.shape({
    metadata: PropTypes.shape({
      itemName: PropTypes.string.isRequired,
      tcrTitle: PropTypes.string.isRequired,
      tcrDescription: PropTypes.string.isRequired,
      logoURI: PropTypes.string
    }).isRequired,
    fileURI: PropTypes.string.isRequired
  }),
  requestWeb3Auth: PropTypes.func.isRequired,
  setSubmissionFormOpen: PropTypes.func.isRequired,
  connectedTCRAddr: PropTypes.string,
  tcrAddress: PropTypes.string
}

Banner.defaultProps = {
  metaEvidence: null,
  connectedTCRAddr: null,
  tcrAddress: null
}

export default Banner
