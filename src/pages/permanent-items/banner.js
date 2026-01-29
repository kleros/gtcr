import { Skeleton, Button, Icon } from 'antd'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Link } from 'react-router-dom'
import React from 'react'
import { Helmet } from 'react-helmet'
import { capitalizeFirstLetter } from 'utils/string'
import { useWeb3Context } from 'web3-react'
import ContractExplorerUrl from 'components/contract-explorer-url'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { truncateAtWord } from 'utils/truncate-at-word'

export const StyledBanner = styled.div`
  display: flex;
  padding: 24px 9.375vw;
  background: ${({ theme }) => theme.bannerGradient};
  box-shadow: 0px 3px 24px ${({ theme }) => theme.shadowColor};
  color: ${({ theme }) => theme.bannerTextColor};
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
  color: ${({ theme }) => theme.bannerTitleColor};
`

export const StyledDescription = styled.span`
  display: block;
  color: ${({ theme }) => theme.bannerDescriptionColor};

  ${smallScreenStyle(
    () => css`
      margin-top: 4px;
    `
  )}
`

export const StyledPolicyAnchor = styled.a`
  text-decoration: none;
  margin-top: 12px;
  color: ${({ theme }) => theme.bannerPolicyLinkColor};

  &:hover {
    color: ${({ theme }) => theme.bannerPolicyLinkHoverColor};
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
  color: ${({ theme }) => theme.bannerLinkColor};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.bannerLinkHoverColor};
  }
`

const StyledTermsLink = styled.a`
  color: ${({ theme }) => theme.bannerTextColor};
  text-decoration: underline;
`

const TCRLogo = ({ logoURI }) =>
  logoURI && <StyledImage src={parseIpfs(logoURI)} alt="item" />

// Registry-specific terms and conditions URLs
const TERMS_AND_CONDITIONS_URLS = {
  '0x7305c57b731876f452da8574a77d05957820e588':
    'https://cdn.kleros.link/ipfs/QmcZ53agYqpPhYijRFzduC3EC64coFGZkhbRN1sPDyW7di'
}

// Render description with "see terms and conditions" as a clickable link
const DescriptionWithTermsLink = ({ description, tcrAddress }) => {
  if (!description) return null

  const termsUrl = TERMS_AND_CONDITIONS_URLS[tcrAddress?.toLowerCase()]

  // If no terms URL configured for this registry, return plain description
  if (!termsUrl) return <span>{description}</span>

  // Match various forms of "see terms and conditions" text
  const termsPattern = /(see\s+(the\s+)?terms?\s*(and|&)?\s*conditions?)/gi
  const parts = description.split(termsPattern)

  if (parts.length === 1)
    // No match found, return plain description
    return <span>{description}</span>

  // Rebuild the description with the link
  const result = []
  let match

  const regex = new RegExp(termsPattern.source, 'gi')
  let lastIndex = 0

  while ((match = regex.exec(description)) !== null) {
    // Add text before the match
    if (match.index > lastIndex)
      result.push(
        <span key={`text-${match.index}`}>
          {description.substring(lastIndex, match.index)}
        </span>
      )

    // Add the match as a link (inline)
    result.push(
      <StyledTermsLink
        key={match.index}
        href={termsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {match[0]}
      </StyledTermsLink>
    )

    lastIndex = regex.lastIndex
  }

  // Add remaining text after last match
  if (lastIndex < description.length)
    result.push(
      <span key={`text-end`}>{description.substring(lastIndex)}</span>
    )

  return <span>{result}</span>
}

const Banner = ({
  metadata,
  requestWeb3Auth,
  setSubmissionFormOpen,
  tcrAddress
}) => {
  const { networkId } = useWeb3Context()
  const defaultTCRAddress = defaultTcrAddresses[networkId]
  const { itemName, title, description, logoURI, policyURI } = metadata || {}

  const normalizedDescription = description
    ? description[description.length - 1] === '.'
      ? description
      : `${description}.`
    : ''

  const fullSeoTitle = title ? `${title} - Kleros · Curate` : 'Kleros · Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 60)

  const fullSeoMetaDescription = metadata
    ? `Explore the ${title} list on Kleros Curate: ${normalizedDescription}`
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
                <StyledTitle>{title}</StyledTitle>
                {defaultTCRAddress && tcrAddress !== defaultTCRAddress && (
                  <TCRLogo logoURI={logoURI} />
                )}
                <ContractExplorerUrl
                  networkId={networkId}
                  contractAddress={tcrAddress}
                />
              </TitleContainer>
              <StyledDescription>
                <DescriptionWithTermsLink
                  description={capitalizeFirstLetter(normalizedDescription)}
                  tcrAddress={tcrAddress}
                />
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
            href={parseIpfs(policyURI || '')}
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

export default Banner
