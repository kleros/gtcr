import { Skeleton, Button, Icon } from 'antd'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Link } from 'react-router-dom'
import React from 'react'
import { Helmet } from 'react-helmet'
import PropTypes from 'prop-types'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import { useWeb3Context } from 'web3-react'
import ContractExplorerUrl from 'components/contract-explorer-url'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { truncateAtWord } from 'utils/truncate-at-word'

export const StyledBanner = styled.div`
  display: flex;
  padding: 24px 9.375vw;
  background: ${({ theme }) =>
    theme.name === 'dark'
      ? `linear-gradient(270deg, ${theme.elevatedBackground} 22.92%, ${theme.componentBackground} 76.25%)`
      : 'linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%)'};
  box-shadow: 0px 3px 24px
    ${({ theme }) => (theme.name === 'dark' ? 'rgba(0, 0, 0, 0.5)' : '#bc9cff')};
  color: ${({ theme }) => (theme.name === 'dark' ? '#d4c8e8' : '#4d00b4')};
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  transition: background 0.3s ease, box-shadow 0.3s ease, color 0.3s ease;
`

export const StyledButton = styled(Button)`
  text-transform: capitalize;
  margin-top: 6px;
`

export const TCRInfoColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  max-width: calc(100% - 220px);

  ${smallScreenStyle(
    () => css`
      max-width: 100%;
    `
  )}
`

export const StyledImage = styled.img`
  object-fit: contain;
  height: 50px;
  width: 50px;
`

export const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 12px;
`

export const StyledTitle = styled.h1`
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 0;
  font-size: 38px;
  font-weight: 600;
  color: ${({ theme }) => (theme.name === 'dark' ? '#a78bfa' : '#4d00b4')};
`

export const StyledDescription = styled.span`
  display: inline;
  color: ${({ theme }) =>
    theme.name === 'dark' ? 'rgba(255, 255, 255, 0.6)' : '#b88cdc'};

  ${smallScreenStyle(
    () => css`
      margin-top: 4px;
    `
  )}
`

export const StyledPolicyAnchor = styled.a`
  text-decoration: none;
  margin-top: 12px;
  color: ${({ theme }) => (theme.name === 'dark' ? '#5faddb' : '#b88cdc')};

  &:hover {
    color: ${({ theme }) => (theme.name === 'dark' ? '#7cc4e8' : '#9b6bc3')};
  }
`

export const ActionCol = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;

  ${smallScreenStyle(
    () => css`
      align-items: flex-start;
    `
  )}
`

export const StyledLink = styled(Link)`
  color: ${({ theme }) => (theme.name === 'dark' ? '#5faddb' : '#4d00b473')};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => (theme.name === 'dark' ? '#7cc4e8' : '#4d00b4')};
  }
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

  const fullSeoTitle = tcrTitle
    ? `${tcrTitle} - Kleros · Curate`
    : 'Kleros · Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 60)

  const fullSeoMetaDescription = metadata
    ? `Explore the ${tcrTitle} list on Kleros Curate: ${normalizedDescription}`
    : 'Explore curated lists on Kleros Curate.'
  const truncatedSeoMetaDescription = truncateAtWord(
    fullSeoMetaDescription,
    160
  )

  return (
    <>
      <Helmet>
        <title> {truncatedSeoTitle} </title>
        <meta name="description" content={truncatedSeoMetaDescription} />
      </Helmet>
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
                {connectedTCRAddr &&
                  connectedTCRAddr !== ZERO_ADDRESS &&
                  !relTcrDisabled && (
                    <>
                      {' '}
                      <StyledLink to={`/tcr/${networkId}/${connectedTCRAddr}`}>
                        View Badges list
                      </StyledLink>
                    </>
                  )}
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
    </>
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
