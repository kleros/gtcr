import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isKlerosArbitrator } from 'config/tcr-addresses'

/*
 * What jurors wrote to justify their votes, read from Kleros Court's own
 * public store: the get-justifications function of kleros/court-functions,
 * the same read court.kleros.io makes for a case's round history. It answers
 * a plain GET with no key and CORS open to any origin, for Ethereum, Gnosis
 * and Sepolia, so the app reads it straight from the browser.
 *
 * The Court posts a juror's text to that store right before it sends their
 * vote, and the store refuses a text for a vote already cast, so a
 * justification exists only alongside a vote: in a hidden-votes court it is
 * posted at the reveal. Each text is keyed by one vote ID of its round, the
 * last of the vote IDs the juror cast with it. The caller still shows a
 * text only once that juror's vote reads as revealed on chain, so nothing
 * here can get ahead of the vote it explains.
 *
 * A case number belongs to its arbitrator, so the store is asked only about
 * disputes Kleros Court arbitrates: another arbitrator's case 1082 is a
 * different case. This is depth, not the page's information: a failed read
 * shows no justification and draws no error.
 */

const BASE = (
  process.env.REACT_APP_COURT_FUNCTIONS_URL || 'https://kleros-api.netlify.app'
).replace(/\/+$/, '')

/** The chains the store answers for that the app also runs on. */
const SUPPORTED = new Set([1, 100, 11155111])

const TIMEOUT_MS = 10_000

/** A juror's text, keyed by the vote ID it was posted with. */
export type JuryJustifications = Record<number, string>

/*
 * Some texts were stored JSON-quoted (mainnet case 1601 reads
 * "\"The ETH address…\""): a whole quoted string is unquoted.
 */
const unquote = (text: string): string => {
  if (text.length < 2 || !text.startsWith('"') || !text.endsWith('"'))
    return text
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'string' ? parsed.trim() : text
  } catch {
    // Not JSON after all: the quotes are the juror's own.
    return text
  }
}

/*
 * The text as a reader should see it: unquoted, with runs of spaces
 * collapsed, as they would be on screen, and blank lines past one dropped.
 * An empty text is no text.
 */
const decode = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = unquote(value.replace(/\r\n?/g, '\n').trim())
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || undefined
}

interface StoredJustification {
  voteID?: unknown
  justification?: unknown
  created_at?: unknown
}

export const fetchJuryJustifications = async (
  chainId: number,
  disputeID: string,
  appeal: number,
  signal?: AbortSignal,
): Promise<JuryJustifications> => {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort)
  const timer = setTimeout(abort, TIMEOUT_MS)
  try {
    const query = new URLSearchParams({
      chainId: String(chainId),
      disputeId: disputeID,
      round: String(appeal),
    })
    const response = await fetch(
      `${BASE}/.netlify/functions/get-justifications?${query}`,
      { signal: controller.signal },
    )
    if (!response.ok)
      throw new Error(`Court justifications: ${response.status}`)
    const body = (await response.json()) as {
      payload?: { justifications?: unknown }
    }
    const rows = body?.payload?.justifications
    if (!Array.isArray(rows)) return {}
    // Oldest first, so a later text for the same vote replaces an earlier
    // one, as the Court itself shows the latest.
    const sorted = [...(rows as StoredJustification[])].sort((a, b) =>
      String(a?.created_at ?? '').localeCompare(String(b?.created_at ?? '')),
    )
    const byVote: JuryJustifications = {}
    for (const row of sorted) {
      const voteID = Number(row?.voteID)
      const text = decode(row?.justification)
      if (Number.isInteger(voteID) && voteID >= 0 && text) byVote[voteID] = text
    }
    return byVote
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * The justifications posted for one round of one dispute, by vote ID, or
 * undefined while loading, where the store has nothing to say (another
 * arbitrator, an unsupported chain, no vote revealed yet) or when the read
 * failed.
 *
 * `revealed` is how many of the round's votes the chain shows revealed. It
 * is part of the key, so the store is read again exactly when the jury read
 * sees another vote come in (a text is posted with its vote, never later),
 * and the texts already shown stay on screen meanwhile.
 */
const useJuryJustifications = ({
  chainId,
  arbitrator,
  disputeID,
  appeal,
  revealed,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  /** The arbitrator's own index for the round (0 for the first). */
  appeal: number
  revealed: number
}) => {
  const enabled =
    revealed > 0 &&
    !!chainId &&
    SUPPORTED.has(chainId) &&
    isKlerosArbitrator(chainId, arbitrator) &&
    disputeID !== undefined &&
    disputeID !== null
  return useQuery({
    queryKey: [
      'juryJustifications',
      chainId,
      arbitrator?.toLowerCase(),
      disputeID,
      appeal,
      revealed,
    ],
    queryFn: ({ signal }) =>
      fetchJuryJustifications(chainId!, disputeID!, appeal, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export default useJuryJustifications
