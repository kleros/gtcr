import { useQuery } from '@tanstack/react-query'
import { klerosDisplayUrl } from 'config/tcr-addresses'

/*
 * A Kleros Court v1 court's name ("Curation", "Blockchain > Technical"…),
 * from the chain's Kleros Display subgraph, the query Scout runs. Undefined
 * where the chain has no endpoint configured or the read fails: callers
 * show the court's number, or nothing, instead.
 */

const COURT_NAME_QUERY = `query CourtName($id: ID!) {
  court(id: $id) { id metadata { name } }
}`

const TIMEOUT_MS = 10_000

export const fetchCourtName = async (
  url: string,
  court: number,
): Promise<string | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: COURT_NAME_QUERY,
        variables: { id: String(court) },
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Kleros Display: ${response.status}`)
    const result = (await response.json()) as {
      data?: { court?: { metadata?: { name?: unknown } | null } | null }
      errors?: unknown[]
    }
    if (result.errors?.length) throw new Error('Kleros Display query failed')
    const name = result.data?.court?.metadata?.name
    return typeof name === 'string' && name.trim() ? name.trim() : null
  } finally {
    clearTimeout(timer)
  }
}

const useCourtName = (
  chainId: number | null | undefined,
  court: number | undefined,
): string | undefined => {
  const url = chainId ? klerosDisplayUrl[chainId] : undefined
  const { data } = useQuery({
    queryKey: ['courtName', chainId, court],
    queryFn: () => fetchCourtName(url!, court!),
    enabled: !!url && court !== undefined,
    // A court's name does not change while a page is open.
    staleTime: Infinity,
    retry: 1,
  })
  return data ?? undefined
}

export default useCourtName
