import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'

const ERC20_SYMBOL_ABI = ['function symbol() view returns (string)']

const useTokenSymbol = (
  tokenAddress: string | undefined,
): { symbol: string; loading: boolean } => {
  const [symbol, setSymbol] = useState<string>('tokens')
  const [loading, setLoading] = useState<boolean>(false)
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()
  const library = useEthersProvider({ chainId: urlChainId ?? networkId })

  const fetchSymbol = useCallback(async () => {
    if (!tokenAddress || !library) return

    setLoading(true)
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_SYMBOL_ABI, library)
      const tokenSymbol = await token.symbol()
      setSymbol(tokenSymbol)
    } catch (err) {
      console.error('Error fetching token symbol:', err)
      setSymbol('tokens')
    }
    setLoading(false)
  }, [tokenAddress, library])

  useEffect(() => {
    fetchSymbol()
  }, [fetchSymbol])

  return { symbol, loading }
}

export default useTokenSymbol
