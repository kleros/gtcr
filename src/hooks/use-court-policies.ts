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

/** Multicall3, deployed at the same address on Ethereum, Gnosis and Sepolia. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const multicall = new ethers.utils.Interface([
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)',
])
const policyInterface = new ethers.utils.Interface(_PolicyRegistry)
const courtsInterface = new ethers.utils.Interface(ARBITRATOR_COURTS_ABI)

interface CourtRead {
  courtID: number
  path: string
  feeForJuror?: string
}

/**
 * Every court's policy path and fee per juror in one eth_call, instead of
 * one call per court ID and one more per court found. Null if the chain has
 * no Multicall3 or the call fails: the caller then asks court by court.
 */
const readCourtsAtOnce = async (
  policyAddress: string,
  library: EthersLibrary,
  arbitratorAddress?: string,
): Promise<CourtRead[] | null> => {
  const ids = Array.from({ length: MAX_COURTS }, (_, i) => i)
  const calls = [
    ...ids.map((id) => ({
      target: policyAddress,
      allowFailure: true,
      callData: policyInterface.encodeFunctionData('policies', [id]),
    })),
    ...(arbitratorAddress
      ? ids.map((id) => ({
          target: arbitratorAddress,
          allowFailure: true,
          callData: courtsInterface.encodeFunctionData('courts', [id]),
        }))
      : []),
  ]
  try {
    const result = await library.call({
      to: MULTICALL3,
      data: multicall.encodeFunctionData('aggregate3', [calls]),
    })
    const [rows] = multicall.decodeFunctionResult('aggregate3', result) as [
      { success: boolean; returnData: string }[],
    ]
    if (rows.length !== calls.length) return null
    return ids.map((courtID) => {
      let path = ''
      let feeForJuror: string | undefined
      try {
        if (rows[courtID].success)
          path = String(
            policyInterface.decodeFunctionResult(
              'policies',
              rows[courtID].returnData,
            )[0],
          )
      } catch {
        // No policy for this ID.
      }
      const court = arbitratorAddress ? rows[MAX_COURTS + courtID] : undefined
      try {
        if (court?.success)
          feeForJuror = courtsInterface
            .decodeFunctionResult('courts', court.returnData)
            .feeForJuror.toString()
      } catch {
        // No such court on this arbitrator: the fee stays unknown.
      }
      return { courtID, path, feeForJuror }
    })
  } catch {
    return null
  }
}

/** The same read, one call per court: the fallback without Multicall3. */
const readCourtsOneByOne = async (
  policyAddress: string,
  library: EthersLibrary,
  arbitratorAddress?: string,
): Promise<CourtRead[]> => {
  const policyRegistry = new ethers.Contract(
    policyAddress,
    _PolicyRegistry,
    library,
  )
  const arbitrator = arbitratorAddress
    ? new ethers.Contract(arbitratorAddress, ARBITRATOR_COURTS_ABI, library)
    : null
  return Promise.all(
    Array.from({ length: MAX_COURTS }, async (_, courtID) => {
      const path: string = await policyRegistry
        .policies(courtID)
        .catch(() => '')
      if (!path) return { courtID, path: '' }
      const feeForJuror: string | undefined = await arbitrator
        ?.courts(courtID)
        .then((court: { feeForJuror?: ethers.BigNumber } & unknown[]) =>
          (court.feeForJuror ?? court[4])?.toString(),
        )
        .catch(() => undefined)
      return { courtID, path, feeForJuror }
    }),
  )
}

const fetchCourtPolicies = async (
  policyAddress: string,
  library: EthersLibrary,
  arbitratorAddress?: string,
): Promise<Court[]> => {
  const read =
    (await readCourtsAtOnce(policyAddress, library, arbitratorAddress)) ??
    (await readCourtsOneByOne(policyAddress, library, arbitratorAddress))
  const fetchedCourts = read.filter(({ path }) => path && path !== '')
  if (fetchedCourts.length === 0) return []

  return Promise.all(
    fetchedCourts.map(async ({ courtID, path, feeForJuror }) => {
      const URL = path.startsWith('/ipfs/')
        ? `${process.env.REACT_APP_IPFS_GATEWAY}${path}`
        : path
      const policy = await fetch(URL)
        .then((response) => response.json())
        .catch(() => null)
      const name = policy?.name || `Court ${courtID}`
      return {
        courtID,
        name,
        description: policy?.description || policy?.summary,
        summary: plainSummary(policy?.description || policy?.summary),
        feeForJuror,
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
