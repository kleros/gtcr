import { Typography, Skeleton, Button, Icon } from 'antd'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Link } from 'react-router-dom'
import React from 'react'
import PropTypes from 'prop-types'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import { useWeb3Context } from 'web3-react'
import ContractExplorerUrl from 'components/contract-explorer-url'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'

export const StyledBanner = styled.div`
  display: flex;
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
`

export const StyledButton = styled(Button)`
  text-transform: capitalize;
  margin-top: 6px;
`

export const TCRInfoColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
`

export const StyledImage = styled.img`
  object-fit: contain;
  height: 50px;
  width: 50px;
  padding: 0 0 5px 5px;
`

export const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 8px;
`

export const StyledTitle = styled.h1`
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 0;
  font-size: 38px;
  font-weight: 600;
`

export const StyledDescription = styled.span`
  display: flex;
  flex-wrap: wrap;
  color: #b88cdc;
`

export const StyledPolicyAnchor = styled.a`
  text-decoration: underline;
  margin-top: 12px;
  width: 100%;
  color: #b88cdc;
  text-align: end;

  ${smallScreenStyle(
    () => css`
      text-align: start;
    `
  )}
`

export const ActionCol = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
`

const TCRLogo = ({ logoURI }) =>
  logoURI && <StyledImage src={parseIpfs(logoURI)} alt="item" />

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
  const defaultTCRAddress = defaultTcrAddresses[networkId]
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
            <TitleContainer>
              <StyledTitle>{tcrTitle}</StyledTitle>
              {defaultTCRAddress && tcrAddress !== defaultTCRAddress && (
                <TCRLogo logoURI={logoURI} />
              )}
              <ContractExplorerUrl
                networkId={networkId}
                contractAddress={tcrAddress}
              />
            </TitleContainer>
            <StyledDescription>
              {capitalizeFirstLetter(normalizedDescription)}
            </StyledDescription>
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
                  to={`/tcr/${networkId}/${connectedTCRAddr}`}
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
          {`Submit ${capitalizeFirstLetter(itemName) || 'Item'}`}
          <Icon type="plus-circle" />
        </StyledButton>
        <StyledPolicyAnchor
          href={parseIpfs(fileURI || '')}
          target="_blank"
          rel="noopener noreferrer"
          id="policy-link"
        >
          View Listing Policies
        </StyledPolicyAnchor>
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
