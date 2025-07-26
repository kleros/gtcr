import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWeb3Context } from 'web3-react'

const ERC20_SYMBOL_ABI = ['function symbol() view returns (string)']

const useTokenSymbol = tokenAddress => {
  const [symbol, setSymbol] = useState('tokens')
  const [loading, setLoading] = useState(false)
  const { library } = useWeb3Context()

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
