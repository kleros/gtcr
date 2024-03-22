import React from 'react'
import { Typography, Skeleton, Icon } from 'antd'
import PropTypes from 'prop-types'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import { useWeb3Context } from 'web3-react'
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
                <StyledLink to={`/tcr/${networkId}/${connectedTCRAddr}`}>
                  View Badges list
                </StyledLink>
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
