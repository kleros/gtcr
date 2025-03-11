import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'

const marketAbi = [
  'function marketName() view returns (string)',
  'function outcomes(uint256) view returns (string)'
]

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
        const ipfsResponse = await fetch(
          `${process.env.REACT_APP_IPFS_GATEWAY}${imagesIpfsHash}`
        )
        if (!ipfsResponse.ok) throw new Error('Failed to fetch IPFS data')
        const ipfsData = await ipfsResponse.json()
        const marketImage = ipfsData.market
        const outcomeImages = ipfsData.outcomes
        const numOutcomes = outcomeImages.length

        const rpcUrls = JSON.parse(process.env.REACT_APP_RPC_URLS || '{}')
        const rpcUrl = rpcUrls[chainId]
        if (!rpcUrl) throw new Error(`No RPC URL found for chainId: ${chainId}`)
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl)

        const marketContract = new ethers.Contract(
          contractAddress,
          marketAbi,
          provider
        )

        const marketName = await marketContract.marketName()
        await delay(250)

        const outcomeNames = []
        for (let i = 0; i < numOutcomes; i++) {
          const outcome = await marketContract.outcomes(i)
          outcomeNames.push(outcome)
          if (i < numOutcomes - 1) await delay(250)
        }

        const outcomes = outcomeNames.map((name: string, index: number) => ({
          name,
          image: outcomeImages[index] || ''
        }))

        setMarketDetails({
          marketName,
          marketImage,
          outcomes
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
            style={{ fontSize: smallDisplay ? '0.9em' : '1em', color: '#333' }}
          >
            {outcome.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export default SeerExtraDetails
