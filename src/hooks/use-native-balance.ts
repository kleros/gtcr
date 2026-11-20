import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'

/**
 * Fetches the connected wallet's native currency balance.
 * Returns the balance as a bigint, or undefined if not yet loaded, and
 * whether a read is under way (so a "check again" can say it is checking).
 */
export default function useNativeBalance() {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const [balance, setBalance] = useState<bigint | undefined>()
  const [checking, setChecking] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!account || !publicClient) return
    setChecking(true)
    try {
      const bal = await publicClient.getBalance({ address: account })
      setBalance(bal)
    } catch (err) {
      console.error('Error fetching native balance:', err)
    }
    setChecking(false)
  }, [account, publicClient])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, checking, refetch: fetchBalance }
}
