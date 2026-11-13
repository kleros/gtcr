import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { getChainById } from 'config/chains'
import { defaultTcrAddresses, subgraphUrl } from 'config/tcr-addresses'

/*
 * Links from before list paths carried a chain (/tcr/<address>/…) are sent
 * on to /tcr/<chain>/<address>/…. The pattern is anchored at the start of
 * the path: a path such as //evil.example/tcr/0x… must not match, or the
 * redirect would hand the router a protocol-relative URL and the browser
 * would leave the site for that host.
 */
const LEGACY_PATH = /^\/tcr\/(0x[0-9a-fA-F]{40})(\/.*)?$/

/* One indexer serves every chain, so the list's own record names its chain. */
const LEGACY_LIST_CHAIN = gql`
  query LegacyListChain($id: String!) {
    lregistry: LRegistry_by_pk(id: $id) {
      chainId
    }
    registry: Registry_by_pk(id: $id) {
      chainId
    }
  }
`

type Outcome = 'invalid' | 'failed'

interface ListChainAnswer {
  lregistry?: { chainId?: number | null } | null
  registry?: { chainId?: number | null } | null
}

/** The chain of the list a legacy link names, or why there is none. */
const legacyChainId = async (address: string): Promise<number | Outcome> => {
  for (const [chainId, list] of Object.entries(defaultTcrAddresses))
    if (String(list).toLowerCase() === address) return Number(chainId)
  const urls = [
    ...new Set(Object.values(subgraphUrl).filter(Boolean) as string[]),
  ]
  const answers = await Promise.allSettled(
    urls.map((url) =>
      request<ListChainAnswer>(url, LEGACY_LIST_CHAIN, { id: address }),
    ),
  )
  for (const answer of answers) {
    if (answer.status !== 'fulfilled') continue
    const chainId =
      answer.value.lregistry?.chainId ?? answer.value.registry?.chainId
    if (chainId && getChainById(chainId)) return Number(chainId)
  }
  return answers.some((answer) => answer.status === 'rejected')
    ? 'failed'
    : 'invalid'
}

const usePathValidation = (): {
  /** False while a legacy link is being resolved. */
  resolved: boolean
  /** The legacy link names no list the indexer knows. */
  invalid: boolean
  /** The indexer did not answer for the legacy link. */
  failed: boolean
  retry: () => void
} => {
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const legacy = useMemo(() => {
    const match = LEGACY_PATH.exec(pathname)
    return match
      ? { address: match[1].toLowerCase(), rest: match[2] ?? '' }
      : null
  }, [pathname])
  // The outcome belongs to the path it was found for: leaving that path
  // leaves its error page behind.
  const [outcome, setOutcome] = useState<{ path: string; state: Outcome }>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!legacy) return
    let cancelled = false
    void (async () => {
      const chainId = await legacyChainId(legacy.address)
      if (cancelled) return
      if (typeof chainId === 'number')
        navigate(
          {
            pathname: `/tcr/${chainId}/${legacy.address}${legacy.rest}`,
            search,
            hash,
          },
          { replace: true },
        )
      else setOutcome({ path: pathname, state: chainId })
    })()
    return () => {
      cancelled = true
    }
  }, [legacy, pathname, search, hash, navigate, attempt])

  const state = legacy && outcome?.path === pathname ? outcome.state : undefined
  return {
    resolved: !legacy || state !== undefined,
    invalid: state === 'invalid',
    failed: state === 'failed',
    retry: () => {
      setOutcome(undefined)
      setAttempt((count) => count + 1)
    },
  }
}

export default usePathValidation
