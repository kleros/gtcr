import React, { useState, useEffect } from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { parseIpfs } from 'utils/ipfs-parse'

interface ISeerExtraDetails {
  chainId: string | number
  contractAddress: string
  imagesIpfsHash: string
}

interface MarketDetails {
  marketName: string
  marketImage?: string
  outcomes: { name: string; image?: string }[]
}

/*
 * The entry and its images file are written by anyone: a path glued to the
 * gateway with no slash (".evil.example/x") would change the host the
 * browser loads from, and a value that is not text would crash the page.
 * parseIpfs keeps the URL on the gateway; anything else shows no image.
 */
const gatewayUrl = (path: unknown): string | undefined =>
  typeof path === 'string' && path.trim() ? parseIpfs(path.trim()) : undefined

const MARKET_QUERY = `
  query SeerMarket($id: ID!) {
    market(id: $id) {
      marketName
      outcomes
    }
  }
`

const Container = styled.div`
  max-width: 600px;
  margin: 16px auto;
  padding: 20px;
  border: 1px solid ${({ theme }) => theme.seerBorderColor};
  border-radius: 8px;
  box-shadow: 0 2px 4px ${({ theme }) => theme.seerShadow};
  background: ${({ theme }) =>
    theme.name === 'dark' ? theme.componentBackground : 'transparent'};
`

const LinkParagraph = styled.p`
  margin-bottom: 16px;
`

const SeerLink = styled.a`
  color: ${({ theme }) => theme.seerLinkColor};
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
    `,
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
  color: ${({ theme }) => theme.seerTextPrimary};
`

const OutcomesHeading = styled.h4`
  margin: 0 0 12px;
  font-size: 1.2em;
  color: ${({ theme }) => theme.seerTextSecondary};
`

const OutcomeItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px;
  background-color: ${({ theme }) => theme.seerBackgroundAlt};
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
  color: ${({ theme }) => theme.seerTextPrimary};
`

const ErrorMessage = styled.p`
  color: ${({ theme }) => (theme.name === 'dark' ? theme.errorColor : 'red')};
  font-size: 14px;
`

const LoadingMessage = styled.p`
  color: ${({ theme }) => theme.seerTextSecondary};
  font-size: 14px;
`

const SeerExtraDetails: React.FC<ISeerExtraDetails> = ({
  chainId,
  contractAddress,
  imagesIpfsHash,
}) => {
  const [marketDetails, setMarketDetails] = useState<MarketDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const chain = String(chainId)
        let subgraphUrl
        if (chain === '1')
          subgraphUrl = process.env.REACT_APP_SEER_SUBGRAPH_MAINNET ?? ''
        else if (chain === '100')
          subgraphUrl = process.env.REACT_APP_SEER_SUBGRAPH_GNOSIS ?? ''
        else throw new Error(`Unsupported chainId: ${chainId}`)

        // The address is the entry's own text: sent as a variable, it can
        // never become part of the query.
        const response = await fetch(subgraphUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: MARKET_QUERY,
            variables: { id: contractAddress.toLowerCase() },
          }),
        })

        if (!response.ok) throw new Error('Subgraph query failed')

        const data = await response.json()

        if (!data.data.market) throw new Error('Market not found in subgraph')

        const { marketName, outcomes } = data.data.market

        const filteredOutcomes = outcomes.filter(
          (outcome: string) => outcome !== 'Invalid result',
        )

        const imagesUrl = gatewayUrl(imagesIpfsHash)
        if (!imagesUrl) throw new Error('No images file')
        const ipfsResponse = await fetch(imagesUrl)
        if (!ipfsResponse.ok) throw new Error('Failed to fetch IPFS data')
        const ipfsData = await ipfsResponse.json()
        const marketImage = gatewayUrl(ipfsData?.market)
        const outcomeImages: unknown[] = Array.isArray(ipfsData?.outcomes)
          ? ipfsData.outcomes
          : []

        const outcomesWithImages = filteredOutcomes.map(
          (name: string, index: number) => ({
            name,
            image: gatewayUrl(outcomeImages[index]),
          }),
        )

        setMarketDetails({
          marketName,
          marketImage,
          outcomes: outcomesWithImages,
        })
      } catch (err) {
        setError(
          `Failed to load market details: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
        console.error(err)
      }
    }

    void fetchData()
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
        {marketImage && <MarketImage src={marketImage} alt="Market" />}
        <MarketName>{marketName}</MarketName>
      </MarketHeader>
      <OutcomesHeading>Outcomes</OutcomesHeading>
      {outcomes.map((outcome, index) => (
        <OutcomeItem key={index}>
          {outcome.image && (
            <OutcomeImage src={outcome.image} alt={`Outcome ${index}`} />
          )}
          <OutcomeName>{outcome.name}</OutcomeName>
        </OutcomeItem>
      ))}
    </Container>
  )
}

export default SeerExtraDetails
