import React, { useState, useEffect } from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'

interface ISeerExtraDetails {
  chainId: string
  contractAddress: string
  imagesIpfsHash: string
}

interface MarketDetails {
  marketName: string
  marketImage: string
  outcomes: { name: string; image: string }[]
}

const Container = styled.div`
  font-family: 'Arial';
  max-width: 600px;
  margin: 16px auto;
  padding: 20px;
  border: 1px solid
    ${({ theme }) => (theme.name === 'dark' ? theme.borderColor : '#e0e0e0')};
  border-radius: 8px;
  box-shadow: 0 2px 4px
    ${({ theme }) =>
      theme.name === 'dark' ? theme.shadowColor : 'rgba(0, 0, 0, 0.1)'};
  background: ${({ theme }) =>
    theme.name === 'dark' ? theme.componentBackground : 'transparent'};
`

const LinkParagraph = styled.p`
  margin-bottom: 16px;
`

const SeerLink = styled.a`
  color: ${({ theme }) =>
    theme.name === 'dark' ? theme.primaryColor : '#007bff'};
  text-decoration: none;
  font-weight: bold;
  font-size: 16px;

  &:hover,
  &:focus {
    text-decoration: underline;
  }
`

const MarketHeader = styled.div`
  display: flex;
  flex-direction: row;
  gap: 16px;
  margin-bottom: 12px;

  ${smallScreenStyle(
    () => css`
      flex-wrap: wrap;
    `
  )}
`

const MarketImage = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 4px;
`

const MarketName = styled.h3`
  margin: 0 0 12px;
  font-size: 1.5em;
  color: ${({ theme }) => (theme.name === 'dark' ? theme.textPrimary : '#333')};
`

const OutcomesHeading = styled.h4`
  margin: 0 0 12px;
  font-size: 1.2em;
  color: ${({ theme }) =>
    theme.name === 'dark' ? theme.textSecondary : '#555'};
`

const OutcomeItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px;
  background-color: ${({ theme }) =>
    theme.name === 'dark' ? theme.elevatedBackground : '#f9f9f9'};
  border-radius: 4px;
`

const OutcomeImage = styled.img`
  max-width: 40px;
  height: auto;
  margin-right: 12px;
  border-radius: 4px;
`

const OutcomeName = styled.span`
  font-size: 1em;
  color: ${({ theme }) => (theme.name === 'dark' ? theme.textPrimary : '#333')};
`

const ErrorMessage = styled.p`
  color: ${({ theme }) => (theme.name === 'dark' ? theme.errorColor : 'red')};
  font-size: 14px;
`

const LoadingMessage = styled.p`
  color: ${({ theme }) =>
    theme.name === 'dark' ? theme.textSecondary : '#666'};
  font-size: 14px;
`

const SeerExtraDetails: React.FC<ISeerExtraDetails> = ({
  chainId,
  contractAddress,
  imagesIpfsHash
}) => {
  const [marketDetails, setMarketDetails] = useState<MarketDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        let subgraphUrl
        if (chainId === '1')
          subgraphUrl = process.env.REACT_APP_SEER_SUBGRAPH_MAINNET ?? ''
        else if (chainId === '100')
          subgraphUrl = process.env.REACT_APP_SEER_SUBGRAPH_GNOSIS ?? ''
        else throw new Error(`Unsupported chainId: ${chainId}`)

        const query = `
          {
            market(id: "${contractAddress.toLowerCase()}") {
              marketName
              outcomes
            }
          }
        `

        const response = await fetch(subgraphUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query })
        })

        if (!response.ok) throw new Error('Subgraph query failed')

        const data = await response.json()

        if (!data.data.market) throw new Error('Market not found in subgraph')

        const { marketName, outcomes } = data.data.market

        const filteredOutcomes = outcomes.filter(
          (outcome: string) => outcome !== 'Invalid result'
        )

        const ipfsResponse = await fetch(
          `${process.env.REACT_APP_IPFS_GATEWAY}${imagesIpfsHash}`
        )
        if (!ipfsResponse.ok) throw new Error('Failed to fetch IPFS data')
        const ipfsData = await ipfsResponse.json()
        const marketImage = ipfsData.market
        const outcomeImages = ipfsData.outcomes

        const outcomesWithImages = filteredOutcomes.map(
          (name: string, index: number) => ({
            name,
            image: outcomeImages[index] || ''
          })
        )

        setMarketDetails({
          marketName,
          marketImage,
          outcomes: outcomesWithImages
        })
      } catch (err) {
        setError(`Failed to load market details: ${err.message}`)
        console.error(err)
      }
    }

    fetchData()
  }, [chainId, contractAddress, imagesIpfsHash])

  if (error) return <ErrorMessage>{error}</ErrorMessage>

  if (!marketDetails)
    return <LoadingMessage>Loading Seer details...</LoadingMessage>

  const { marketName, marketImage, outcomes } = marketDetails

  return (
    <Container>
      <LinkParagraph>
        <SeerLink
          href={`https://app.seer.pm/markets/${chainId}/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Go to Seer
        </SeerLink>
      </LinkParagraph>
      <MarketHeader>
        <MarketImage
          src={`${process.env.REACT_APP_IPFS_GATEWAY}${marketImage}`}
          alt="Market"
        />
        <MarketName>{marketName}</MarketName>
      </MarketHeader>
      <OutcomesHeading>Outcomes</OutcomesHeading>
      {outcomes.map((outcome, index) => (
        <OutcomeItem key={index}>
          <OutcomeImage
            src={`${process.env.REACT_APP_IPFS_GATEWAY}${outcome.image}`}
            alt={`Outcome ${index}`}
          />
          <OutcomeName>{outcome.name}</OutcomeName>
        </OutcomeItem>
      ))}
    </Container>
  )
}

export default SeerExtraDetails
