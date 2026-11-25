import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NETWORKS } from 'config/networks'
import {
  getListOfListsAddresses,
  getListOfListsHistory,
} from 'config/list-of-lists'
import { AGENT_FILES, SKILL_PATH } from './content'

/*
 * The files the guide gives agents (public/), checked against the app's own
 * config: an agent must be sent to the lists of lists the app trusts, and
 * every file the guide names must be served. Upstream's copy of the skill
 * still named the Gnosis list of lists Kleros replaced on 17 Nov 2026, which
 * is why the app keeps its own verify-your-list.md.
 */

const PUBLIC_DIR = fileURLToPath(new URL('../../../public/', import.meta.url))
const publicFile = (path: string) => PUBLIC_DIR + path.replace(/^\//, '')
const read = (path: string) => readFileSync(publicFile(path), 'utf8')

const CHAINS = [NETWORKS.ethereum, NETWORKS.gnosis, NETWORKS.sepolia]
const currentListOfLists = (chainId: number) =>
  getListOfListsAddresses(chainId)[0]
/** Lists of lists Kleros replaced: they grant nothing (lowercase). */
const REPLACED = CHAINS.flatMap((chainId) =>
  getListOfListsHistory(chainId).filter(
    (address) => address !== currentListOfLists(chainId),
  ),
)

const REFERENCES_DIR = '/skills/kleros-curate/references/'
/** The skill's references kept here; the others redirect upstream. */
const KEPT_REFERENCES = readdirSync(publicFile(REFERENCES_DIR))
const CONTEXT_FILES = [
  '/llms.txt',
  '/llms-full.txt',
  '/curate-agent-context.md',
]
/** Everything an agent reads from the app. */
const AGENT_TEXTS = [
  ...CONTEXT_FILES,
  SKILL_PATH,
  ...KEPT_REFERENCES.map((name) => REFERENCES_DIR + name),
]

describe('the files the guide gives agents', () => {
  it('are all served', () => {
    const local = AGENT_FILES.filter((file) => file.href.startsWith('/'))
    expect(local.length).toBeGreaterThan(0)
    for (const file of local)
      expect(existsSync(publicFile(file.href)), file.href).toBe(true)
  })

  it('send a list for verification to the list of lists the app trusts', () => {
    // | Network | `chainId` | `address` | `scan start block` |
    const rows = [
      ...read(`${REFERENCES_DIR}verify-your-list.md`).matchAll(
        /^\| [^|]+ \| `(\d+)` \| `(0x[0-9a-fA-F]{40})` \| `\d+` \|$/gm,
      ),
    ]
    expect(
      Object.fromEntries(
        rows.map(([, chainId, address]) => [chainId, address.toLowerCase()]),
      ),
    ).toEqual(
      Object.fromEntries(
        CHAINS.map((chainId) => [String(chainId), currentListOfLists(chainId)]),
      ),
    )
  })

  it('name every list of lists in the context files', () => {
    for (const path of CONTEXT_FILES)
      for (const chainId of CHAINS)
        expect(read(path).toLowerCase(), path).toContain(
          currentListOfLists(chainId),
        )
  })

  it('name a replaced list of lists only to say never to use it', () => {
    expect(REPLACED.length).toBeGreaterThan(0)
    for (const path of AGENT_TEXTS)
      for (const paragraph of read(path).split(/\n\s*\n/))
        if (
          REPLACED.some((address) => paragraph.toLowerCase().includes(address))
        )
          expect(paragraph, path).toMatch(/never submit/i)
  })

  it('keep only references the skill reads', () => {
    // A kept file under a name the skill does not use would never be read,
    // and the redirect would serve upstream's copy in its place.
    const named = new Set(
      [...read(SKILL_PATH).matchAll(/references\/([\w-]+\.md)/g)].map(
        ([, name]) => name,
      ),
    )
    expect(KEPT_REFERENCES.length).toBeGreaterThan(0)
    for (const name of KEPT_REFERENCES) expect(named, name).toContain(name)
  })
})
