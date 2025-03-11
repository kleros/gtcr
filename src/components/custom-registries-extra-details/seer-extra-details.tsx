import React, { useState, useEffect } from 'react'

interface ISeerExtraDetails {
  chainId: string
  contractAddress: string
  imagesIpfsHash: string
  smallDisplay?: boolean
}

interface MarketDetails {
  marketName: string
  marketImage: string
  outcomes: { name: string; image: string }[]
}

const SeerExtraDetails: React.FC<ISeerExtraDetails> = ({
  chainId,
  contractAddress,
  imagesIpfsHash,
  smallDisplay = false
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

        console.log({ response })

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

  if (error)
    return (
      <p
        style={{
          color: 'red',
          fontFamily: 'Arial, sans-serif',
          fontSize: smallDisplay ? '12px' : '14px'
        }}
      >
        {error}
      </p>
    )

  if (!marketDetails)
    return (
      <p
        style={{
          fontFamily: 'Arial, sans-serif',
          color: '#666',
          fontSize: smallDisplay ? '12px' : '14px'
        }}
      >
        Loading Seer details...
      </p>
    )

  const { marketName, marketImage, outcomes } = marketDetails

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: smallDisplay ? '300px' : '600px',
        margin: '16px auto',
        padding: smallDisplay ? '10px' : '20px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}
    >
      <p style={{ marginBottom: '16px' }}>
        <a
          href={`https://app.seer.pm/markets/${chainId}/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#007bff',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: smallDisplay ? '14px' : '16px'
          }}
          onMouseOver={e =>
            (e.currentTarget.style.textDecoration = 'underline')
          }
          onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
          onFocus={e => (e.currentTarget.style.textDecoration = 'underline')}
          onBlur={e => (e.currentTarget.style.textDecoration = 'none')}
        >
          Go to Seer
        </a>
      </p>
      <img
        src={`${process.env.REACT_APP_IPFS_GATEWAY}${marketImage}`}
        alt="Market"
        style={{
          maxWidth: smallDisplay ? '32px' : '48px',
          height: 'auto',
          borderRadius: '4px',
          marginBottom: smallDisplay ? '8px' : '16px'
        }}
      />
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: smallDisplay ? '1.2em' : '1.5em',
          color: '#333'
        }}
      >
        {marketName}
      </h3>
      <h4
        style={{
          margin: '0 0 12px',
          fontSize: smallDisplay ? '1em' : '1.2em',
          color: '#555'
        }}
      >
        Outcomes
      </h4>
      {outcomes.map((outcome, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: smallDisplay ? '6px' : '12px',
            padding: smallDisplay ? '4px' : '8px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px'
          }}
        >
          <img
            src={`${process.env.REACT_APP_IPFS_GATEWAY}${outcome.image}`}
            alt={`Outcome ${index}`}
            style={{
              maxWidth: smallDisplay ? '24px' : '40px',
              height: 'auto',
              marginRight: smallDisplay ? '6px' : '12px',
              borderRadius: '4px'
            }}
          />
          <span
            style={{
              fontSize: smallDisplay ? '0.9em' : '1em',
              color: '#333'
            }}
          >
            {outcome.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export default SeerExtraDetails
