import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'

/**
 * Fetches the connected wallet's native currency balance.
 * Returns the balance as a bigint, or undefined if not yet loaded.
 */
export default function useNativeBalance() {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const [balance, setBalance] = useState<bigint | undefined>()

  const fetchBalance = useCallback(async () => {
    if (!account || !publicClient) return
    try {
      const bal = await publicClient.getBalance({ address: account })
      setBalance(bal)
    } catch (err) {
      console.error('Error fetching native balance:', err)
    }
  }, [account, publicClient])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, refetch: fetchBalance }
}
