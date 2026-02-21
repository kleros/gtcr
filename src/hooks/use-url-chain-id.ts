import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Extract the chain ID from the current URL path (e.g. /tcr/1/0x...).
 * @returns {number|null} The chain ID from the URL, or null if not found.
 */
const useUrlChainId = () => {
  const location = useLocation()
  return useMemo(() => {
    const match = location.pathname.match(/\/tcr\/(\d+)\//)
    return match ? Number(match[1]) : null
  }, [location.pathname])
}

export default useUrlChainId
