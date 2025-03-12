import React from 'react'

interface ISeerCardContent {
  chainId: string
  contractAddress: string
  marketName?: string
  outcomes?: string[]
}

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
    return (
      <p
        style={{
          fontFamily: 'Arial, sans-serif',
          color: '#666',
          fontSize: '12px'
        }}
      >
        Loading Seer details...
      </p>
    )

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '300px',
        margin: '16px auto',
        padding: '10px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}
    >
      <p>
        <a
          href={`https://app.seer.pm/markets/${chainId}/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#007bff',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '14px'
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
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: '1.2em',
          color: '#333'
        }}
      >
        {marketName}
      </h3>
      <h4
        style={{
          margin: '0 0 12px',
          fontSize: '0.9em',
          color: '#666'
        }}
      >
        Outcomes
      </h4>
      {filteredOutcomes?.map((outcome, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '6px',
            padding: '4px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px'
          }}
        >
          <span
            style={{
              fontSize: '0.9em',
              color: '#333'
            }}
          >
            {outcome}
          </span>
        </div>
      ))}
    </div>
  )
}

export default SeerCardContent
