import { useQuery } from '@tanstack/react-query'
import { ethers } from 'ethers'
import { PolicyRegistryABI as _PolicyRegistry } from 'utils/abis/policy-registry'

const MAX_COURTS = 50

interface Court {
  courtID: number
  name: string
  key: string
  value: string
  label: string
}

const fetchCourtPolicies = async (
  policyAddress: string,
  library: EthersLibrary,
): Promise<Court[]> => {
  const policyRegistry = new ethers.Contract(
    policyAddress,
    _PolicyRegistry,
    library,
  )

  const policyPaths = await Promise.all(
    Array.from({ length: MAX_COURTS }, (_, i) =>
      policyRegistry
        .policies(i)
        .then((path: string) => ({ courtID: i, path }))
        .catch(() => ({ courtID: i, path: '' })),
    ),
  )

  const fetchedCourts = policyPaths.filter(({ path }) => path && path !== '')
  if (fetchedCourts.length === 0) return []

  return Promise.all(
    fetchedCourts.map(async ({ courtID, path }) => {
      const URL = path.startsWith('/ipfs/')
        ? `${process.env.REACT_APP_IPFS_GATEWAY}${path}`
        : path
      try {
        const { name } = await (await fetch(URL)).json()
        return {
          courtID,
          name,
          key: String(courtID),
          value: String(courtID),
          label: name,
        }
      } catch {
        return {
          courtID,
          name: `Court ${courtID}`,
          key: String(courtID),
          value: String(courtID),
          label: `Court ${courtID}`,
        }
      }
    }),
  )
}

const useCourtPolicies = (
  policyAddress: string | undefined,
  library: EthersLibrary | null,
) =>
  useQuery({
    queryKey: ['courtPolicies', policyAddress],
    queryFn: () => fetchCourtPolicies(policyAddress!, library!),
    enabled: !!policyAddress && !!library,
    staleTime: Infinity,
  })

export default useCourtPolicies
export type { Court }
