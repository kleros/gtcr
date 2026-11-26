import { useQuery } from '@tanstack/react-query'
import { getFormattedPath } from 'utils/ipfs-parse'
import { fetchMetaEvidenceFile } from 'utils/meta-evidence-guard'
import { rulingTitlesOf, type RulingTitles } from 'utils/ruling-titles'

/**
 * The court's titles for a dispute's choices, read from the MetaEvidence
 * file the request or challenge was made under (utils/ruling-titles.ts).
 * Undefined while loading, without a file, or when the file has none: the
 * caller then keeps its own words, so this never holds anything up.
 *
 * Only an IPFS file is read. A list can name any URI as its MetaEvidence,
 * and the court's titles live in a file nobody can change afterwards;
 * that also lets an answer be kept for the session.
 */
const useRulingTitles = (
  metaEvidenceURI: string | null | undefined,
): RulingTitles | undefined => {
  const path =
    typeof metaEvidenceURI === 'string' && metaEvidenceURI.trim()
      ? getFormattedPath(metaEvidenceURI.trim())
      : undefined
  const ipfs = !!path && path.startsWith('/ipfs/')
  const { data } = useQuery({
    queryKey: ['rulingTitles', path],
    queryFn: async () =>
      rulingTitlesOf(await fetchMetaEvidenceFile(path!)) ?? null,
    enabled: ipfs,
    staleTime: Infinity,
    retry: 1,
  })
  return data ?? undefined
}

export default useRulingTitles
