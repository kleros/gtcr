import { useQuery } from '@tanstack/react-query'
import { ethers } from 'ethers'
import { PolicyRegistryABI as _PolicyRegistry } from 'utils/abis/policy-registry'
import { truncateAtWord } from 'utils/truncate-at-word'

const MAX_COURTS = 50

interface Court {
  courtID: number
  name: string
  description?: string
  /** The description as plain text (policies are written in markdown), short. */
  summary?: string
  feeForJuror?: string
  key: string
  value: string
  label: string
}

const SUMMARY_LENGTH = 280

/** Court policies are markdown; the app shows them inline as plain text. */
const plainSummary = (markdown?: string): string | undefined => {
  if (!markdown) return undefined
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // A heading or a bold label alone on its line becomes "Label:".
    .replace(/^\s{0,3}#{1,6}\s+(.+?)\s*:?\s*$/gm, '$1:')
    .replace(/^\s*(\*\*|__)([^*_\n]+?)\1\s*:?\s*$/gm, '$2:')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*(\S(?:[^*]*\S)?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? truncateAtWord(text, SUMMARY_LENGTH) : undefined
}

// KlerosLiquid's public courts() getter skips the struct's children array:
// it returns six values (checked on Gnosis: courts(1) gives a 7.2 xDAI fee).
// Declaring `uint256[] children` made every decode fail, so the fee per
// juror always read as unavailable.
const ARBITRATOR_COURTS_ABI = [
  'function courts(uint256) view returns (uint96 parent, bool hiddenVotes, uint256 minStake, uint256 alpha, uint256 feeForJuror, uint256 jurorsForCourtJump)',
]

const fetchCourtPolicies = async (
  policyAddress: string,
  library: EthersLibrary,
  arbitratorAddress?: string,
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

  const arbitrator = arbitratorAddress
    ? new ethers.Contract(arbitratorAddress, ARBITRATOR_COURTS_ABI, library)
    : null

  return Promise.all(
    fetchedCourts.map(async ({ courtID, path }) => {
      const URL = path.startsWith('/ipfs/')
        ? `${process.env.REACT_APP_IPFS_GATEWAY}${path}`
        : path
      const [policy, courtData] = await Promise.all([
        fetch(URL)
          .then((response) => response.json())
          .catch(() => null),
        arbitrator
          ?.courts(courtID)
          .then((court: { feeForJuror?: ethers.BigNumber } & unknown[]) =>
            (court.feeForJuror ?? court[4])?.toString(),
          )
          .catch(() => undefined),
      ])
      const name = policy?.name || `Court ${courtID}`
      return {
        courtID,
        name,
        description: policy?.description || policy?.summary,
        summary: plainSummary(policy?.description || policy?.summary),
        feeForJuror: courtData,
        key: String(courtID),
        value: String(courtID),
        label: name,
      }
    }),
  )
}

const useCourtPolicies = (
  policyAddress: string | undefined,
  library: EthersLibrary | null | undefined,
  arbitratorAddress?: string,
) =>
  useQuery({
    queryKey: ['courtPolicies', policyAddress, arbitratorAddress],
    queryFn: () =>
      fetchCourtPolicies(policyAddress!, library!, arbitratorAddress),
    enabled: !!policyAddress && !!library,
    staleTime: Infinity,
  })

export default useCourtPolicies
export type { Court }
