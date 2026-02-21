import { Skeleton, Button } from 'components/ui'
import Icon from 'components/ui/Icon'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Link, useParams } from 'react-router-dom'
import React from 'react'
import useDocumentHead from 'hooks/use-document-head'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import ContractExplorerUrl from 'components/contract-explorer-url'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { truncateAtWord } from 'utils/truncate-at-word'

export const StyledBanner = styled.div`
  display: flex;
  padding: 24px var(--horizontal-padding);
  background: ${({ theme }) => theme.bannerGradient};
  box-shadow: 0px 3px 24px ${({ theme }) => theme.shadowColor};
  color: ${({ theme }) => theme.bannerTextColor};
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  transition:
    background 0.3s ease,
    box-shadow 0.3s ease,
    color 0.3s ease;
`

export const StyledButton = styled(Button)`
  text-transform: capitalize;
`

export const TCRInfoColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  max-width: calc(100% - 220px);

  ${smallScreenStyle(
    () => css`
      max-width: 100%;
    `,
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
  align-items: center;
  margin: 0;
  font-size: 36px;
  line-height: 1.2;
  font-weight: 600;
  color: ${({ theme }) => theme.bannerTitleColor};
`

export const StyledDescription = styled.span`
  display: inline;
  margin-top: 4px;
  color: ${({ theme }) => theme.bannerDescriptionColor};
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
    `,
  )}
`

export const StyledLink = styled(Link)`
  color: ${({ theme }) => theme.bannerLinkColor};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.bannerLinkHoverColor};
  }
`

interface TCRLogoProps {
  logoURI?: string | null
}

const TCRLogo = ({ logoURI = null }: TCRLogoProps) =>
  logoURI && <StyledImage src={parseIpfs(logoURI)} alt="item" />

interface BannerProps {
  metaEvidence?: MetaEvidence
  setSubmissionFormOpen: (open: boolean) => void
  connectedTCRAddr?: string | null
  tcrAddress?: string | null
}

const Banner = ({
  metaEvidence = null,
  setSubmissionFormOpen,
  connectedTCRAddr = null,
  tcrAddress = null,
}: BannerProps) => {
  const { chainId: networkId } = useParams()
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
    160,
  )

  useDocumentHead(truncatedSeoTitle, truncatedSeoMetaDescription)

  return (
    <>
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
              <Skeleton active paragraph={false} title={{ width: '300px' }} />
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            </>
          )}
        </TCRInfoColumn>
        <ActionCol>
          <StyledButton
            type="primary"
            size="large"
            onClick={() => setSubmissionFormOpen(true)}
            id="submit-item-button"
          >
            {`Submit ${capitalizeFirstLetter(itemName) || 'Item'}`}
            <Icon type="plus-circle-outline" />
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

export default Banner
