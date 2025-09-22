import { useState, useEffect } from 'react'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'

const useSeerMarketsData = (
  chainId: string,
  tcrAddress: string,
  items: any[]
) => {
  const [seerMarketsData, setSeerMarketsData] = useState({})

  useEffect(() => {
    if (!isSeerRegistry(tcrAddress, chainId) || !items || items.length === 0)
      return

    const fetchSeerData = async () => {
      const contractAddresses = items
        .map(item => item?.decodedData?.[0]?.toLowerCase())
        .filter(Boolean)
      if (contractAddresses.length === 0) return

      try {
        let subgraphUrl = ''
        if (chainId === '1')
          subgraphUrl = process.env.REACT_APP_SEER_SUBGRAPH_MAINNET ?? ''
        else if (chainId === '100')
          subgraphUrl = process.env.REACT_APP_SEER_SUBGRAPH_GNOSIS ?? ''
        const query = `
          {
            markets(where: {id_in: [${contractAddresses
              .map(addr => `"${addr}"`)
              .join(',')}]}) {
              id
              marketName
              outcomes
            }
          }
        `
        const response = await fetch(subgraphUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })
        if (!response.ok) throw new Error('Seer subgraph query failed')
        const data = await response.json()
        const markets = data.data.markets
        const marketsData = markets.reduce((acc: any[], market: any) => {
          acc[market.id] = {
            marketName: market.marketName,
            outcomes: market.outcomes
          }
          return acc
        }, {})
        setSeerMarketsData(marketsData)
      } catch (err) {
        console.error('Failed to fetch Seer markets:', err)
      }
    }

    fetchSeerData()
  }, [chainId, tcrAddress, items])

  return seerMarketsData
}

export default useSeerMarketsData
