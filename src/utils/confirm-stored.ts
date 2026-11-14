import { parseIpfs } from 'utils/ipfs-parse'

/*
 * Before a deposit is sent, the file it points to is read back.
 *
 * A Light or Stake entry is its file: the list stores only the IPFS path.
 * An entry whose file cannot be read shows no fields, to curators and to
 * jurors alike, and invites a challenge; the same goes for an evidence file
 * nobody can open. So the JSON just uploaded is fetched from the gateway
 * the app reads from, a few times in case the gateway is a moment behind,
 * and nothing is sent if it never answers.
 */

const TRIES = 4
const TRY_TIMEOUT_MS = 6_000
const PAUSE_MS = 1_500

export const confirmStored = async (path: string): Promise<void> => {
  const url = parseIpfs(path)
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TRY_TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (response.ok) return
    } catch {
      // Not there yet, or the gateway did not answer: try again.
    } finally {
      window.clearTimeout(timer)
    }
    if (attempt < TRIES - 1)
      await new Promise((resolve) => window.setTimeout(resolve, PAUSE_MS))
  }
  throw new Error(
    'The uploaded file could not be read back from IPFS, so nothing was sent. Try again in a moment.',
  )
}
