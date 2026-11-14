import { useQuery } from '@tanstack/react-query'
import { fetchMetaEvidence } from './tcr-view'
import { parseIpfs } from 'utils/ipfs-parse'
import { sanitizeMetaEvidence } from 'utils/meta-evidence-guard'

const ONE_DAY = 24 * 60 * 60 * 1000

/**
 * Fetches MetaEvidence for any TCR address via the subgraph.
 * Cached for 1 day (meta evidence rarely changes but is not immutable).
 */
const useTcrMetaEvidence = (
  tcrAddress: string | undefined,
  networkId: number | undefined,
) =>
  useQuery({
    queryKey: ['tcrMetaEvidence', tcrAddress?.toLowerCase(), networkId],
    queryFn: async () => {
      const result = await fetchMetaEvidence(tcrAddress!, networkId!)
      if (!result) return null
      const response = await fetch(parseIpfs(result.metaEvidenceURI))
      // Another list's file, shown on this page: only well-typed fields.
      return sanitizeMetaEvidence(await response.json())
    },
    enabled: !!tcrAddress && !!networkId,
    staleTime: ONE_DAY,
  })

export default useTcrMetaEvidence
