import React from 'react'
import styled from 'styled-components'

interface ISeerCardContent {
  chainId: string
  contractAddress: string
  marketName?: string
  outcomes?: string[]
}

const Container = styled.div`
  font-family: 'Arial';
  max-width: 300px;
  margin: 16px auto;
  padding: 10px;
  border: 1px solid
    ${({ theme }) => (theme.name === 'dark' ? theme.borderColor : '#e0e0e0')};
  border-radius: 8px;
  box-shadow: 0 2px 4px
    ${({ theme }) =>
      theme.name === 'dark' ? theme.shadowColor : 'rgba(0, 0, 0, 0.1)'};
  background: ${({ theme }) =>
    theme.name === 'dark' ? theme.componentBackground : 'transparent'};
`

const SeerLink = styled.a`
  color: ${({ theme }) =>
    theme.name === 'dark' ? theme.primaryColor : '#007bff'};
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;

  &:hover,
  &:focus {
    text-decoration: underline;
  }
`

const MarketName = styled.h3`
  margin: 0 0 12px;
  font-size: 1.2em;
  color: ${({ theme }) => (theme.name === 'dark' ? theme.textPrimary : '#333')};
`

const OutcomesHeading = styled.h4`
  margin: 0 0 12px;
  font-size: 0.9em;
  color: ${({ theme }) =>
    theme.name === 'dark' ? theme.textSecondary : '#666'};
`

const OutcomeItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  padding: 4px;
  background-color: ${({ theme }) =>
    theme.name === 'dark' ? theme.elevatedBackground : '#f9f9f9'};
  border-radius: 4px;
`

const OutcomeName = styled.span`
  font-size: 0.9em;
  color: ${({ theme }) => (theme.name === 'dark' ? theme.textPrimary : '#333')};
`

const LoadingMessage = styled.p`
  color: ${({ theme }) =>
    theme.name === 'dark' ? theme.textSecondary : '#666'};
  font-size: 12px;
`

const SeerCardContent: React.FC<ISeerCardContent> = ({
  chainId,
  contractAddress,
  marketName,
  outcomes
}) => {
  const filteredOutcomes = outcomes?.filter(
    (outcome: string) => outcome !== 'Invalid result'
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
