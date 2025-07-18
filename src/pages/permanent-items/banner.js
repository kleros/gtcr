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
`

export const StyledDescription = styled.span`
  display: flex;
  flex-wrap: wrap;
  color: #b88cdc;

  ${smallScreenStyle(
    () => css`
      margin-top: 4px;
    `
  )}
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

export const StyledLink = styled(Link)`
  color: #4d00b473;
`

const TCRLogo = ({ logoURI }) =>
  logoURI && <StyledImage src={parseIpfs(logoURI)} alt="item" />

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
