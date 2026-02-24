import React from 'react'
import styled from 'styled-components'

interface ISeerCardContent {
  chainId: string | number
  contractAddress: string
  marketName?: string
  outcomes?: string[]
}

const Container = styled.div`
  max-width: 300px;
  margin: 16px auto;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.seerBorderColor};
  border-radius: 8px;
  box-shadow: 0 2px 4px ${({ theme }) => theme.seerShadow};
  background: ${({ theme }) =>
    theme.name === 'dark' ? theme.componentBackground : 'transparent'};
`

const SeerLink = styled.a`
  color: ${({ theme }) => theme.seerLinkColor};
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;

  &:hover,
  &:focus {
    text-decoration: underline;
  }
`

const MarketName = styled.div`
  margin: 0 0 12px;
  font-size: 1.2em;
  font-weight: 400;
  color: ${({ theme }) => theme.seerTextPrimary};
`

const OutcomesHeading = styled.div`
  margin: 0 0 12px;
  font-size: 0.9em;
  font-weight: 500;
  color: ${({ theme }) => theme.seerTextSecondary};
`

const OutcomeItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  padding: 4px;
  background-color: ${({ theme }) => theme.seerBackgroundAlt};
  border-radius: 4px;
`

const OutcomeName = styled.span`
  font-size: 0.9em;
  color: ${({ theme }) => theme.seerTextPrimary};
`

const LoadingMessage = styled.p`
  color: ${({ theme }) => theme.seerTextSecondary};
  font-size: 12px;
`

const SeerCardContent: React.FC<ISeerCardContent> = ({
  chainId,
  contractAddress,
  marketName,
  outcomes,
}) => {
  const filteredOutcomes = outcomes?.filter(
    (outcome: string) => outcome !== 'Invalid result',
  )

  if (!marketName)
    return <LoadingMessage>Loading Seer details...</LoadingMessage>

  return (
    <Container>
      <p>
        <SeerLink
          href={`https://app.seer.pm/markets/${chainId}/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Go to Seer
        </SeerLink>
      </p>
      <MarketName>{marketName}</MarketName>
      <OutcomesHeading>Outcomes</OutcomesHeading>
      {filteredOutcomes?.map((outcome, index) => (
        <OutcomeItem key={index}>
          <OutcomeName>{outcome}</OutcomeName>
        </OutcomeItem>
      ))}
    </Container>
  )
}

export default SeerCardContent
