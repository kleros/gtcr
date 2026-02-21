import React from 'react'
import { Skeleton } from 'components/ui'
import Icon from 'components/ui/Icon'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import { useParams } from 'react-router-dom'
import ContractExplorerUrl from 'components/contract-explorer-url'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import {
  StyledImage,
  StyledBanner,
  TCRInfoColumn,
  TitleContainer,
  StyledTitle,
  StyledDescription,
  ActionCol,
  StyledButton,
  StyledPolicyAnchor,
  StyledLink
} from 'pages/light-items/banner'

interface TCRLogoProps {
  logoURI?: string | null
}

const TCRLogo = ({ logoURI = null }: TCRLogoProps) =>
  logoURI && <StyledImage src={parseIpfs(logoURI)} alt="item" />

interface BannerProps {
  metaEvidence?: any
  setSubmissionFormOpen: (open: boolean) => void
  connectedTCRAddr?: string | null
  tcrAddress?: string | null
}

const Banner = ({
  metaEvidence = null,
  setSubmissionFormOpen,
  connectedTCRAddr = null,
  tcrAddress = null
}: BannerProps) => {
  const { chainId: networkId } = useParams()
  const defaultTCRAddress = defaultTcrAddresses[networkId]
  const { metadata, fileURI } = metaEvidence || {}
  const { itemName, tcrTitle, tcrDescription, logoURI, relTcrDisabled } =
    metadata || {}

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
              {capitalizeFirstLetter(tcrDescription)}
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
            <Skeleton
              active
              paragraph={{ rows: 1 }}
              title={false}
            />
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
  )
}


export default Banner
