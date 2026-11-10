// Scans every Curate factory's NewGTCR(address) logs and writes the list
// creation times snapshot that utils/registry-creation.ts ships with, so a
// browser only reads the blocks after it. Run it now and then (e.g. before a
// release), from the repo root:
//   node scripts/registry-creation-snapshot.mjs . src/config/registry-creation-snapshot.json
// The Alchemy key is read from <repo root>/.env and never printed. Keep the
// factories below in sync with registryFactories in src/config/tcr-addresses.ts.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , repo, output] = process.argv
const env = readFileSync(join(repo, '.env'), 'utf8')
const KEY = (env.match(/^REACT_APP_ALCHEMY_API_KEY=(.*)$/m)?.[1] ?? '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
if (!KEY) throw new Error('No Alchemy key in .env')

const redact = (text) => String(text).split(KEY).join('***')
const log = (...parts) => console.log(...parts.map(redact))

const TOPIC =
  '0x704e94f24d7a41dd1af49e0bbd12aa4fb9ade0accd11001b9d1de7d756a5464f'
/** Blocks left below the head, so a reorg cannot hide a creation. */
const MARGIN = 64

const CHAINS = {
  1: {
    rpcs: [`https://eth-mainnet.g.alchemy.com/v2/${KEY}`],
    factories: [
      ['0xb9dDC813AcAF3fD7aBC4C16735A09Bc1C0EE0054', 13810085],
      ['0xe9dd523600b74b8ef0af164687079a6c437f9cd5', 10247117],
    ],
  },
  100: {
    rpcs: [
      'https://rpc.gnosischain.com',
      `https://gnosis-mainnet.g.alchemy.com/v2/${KEY}`,
    ],
    factories: [
      ['0x08e58Bc26CFB0d346bABD253A1799866F269805a', 19592773],
      ['0x794Cee5a6e1501b633eC13b8c1e327d9860FE039', 16969180],
    ],
  },
  11155111: {
    rpcs: [
      `https://eth-sepolia.g.alchemy.com/v2/${KEY}`,
      'https://ethereum-sepolia-rpc.publicnode.com',
    ],
    factories: [
      ['0x3FB8314C628E9afE7677946D3E23443Ce748Ac17', 4048287],
      ['0xcB4B48d2A7a44247A00048963F169d2b4Ab045a6', 4048282],
    ],
  },
}

const hex = (n) => `0x${n.toString(16)}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const call = async (url, method, params) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (response.status === 429) {
      await sleep(1000 * (attempt + 1))
      continue
    }
    const reply = await response.json().catch(() => null)
    if (!response.ok || !reply)
      throw new Error(`HTTP ${response.status} for ${method}`)
    if (reply.error) throw new Error(`${method}: ${reply.error.message}`)
    return reply.result
  }
  throw new Error(`${method}: rate limited`)
}

/** Logs over [from, to] in one request. */
const getLogs = (url, addresses, from, to) =>
  call(url, 'eth_getLogs', [
    { address: addresses, topics: [TOPIC], fromBlock: hex(from), toBlock: hex(to) },
  ])

/** Fixed chunks of `span` blocks, `parallel` at a time. */
const chunkedLogs = async (url, addresses, from, to, span, parallel) => {
  const ranges = []
  for (let start = from; start <= to; start += span)
    ranges.push([start, Math.min(start + span - 1, to)])
  const logs = []
  for (let i = 0; i < ranges.length; i += parallel) {
    const batch = await Promise.all(
      ranges
        .slice(i, i + parallel)
        .map(([a, b]) => call(url, 'eth_getLogs', [
          { address: addresses, topics: [TOPIC], fromBlock: hex(a), toBlock: hex(b) },
        ])),
    )
    for (const part of batch) logs.push(...part)
    if (i % (parallel * 50) === 0)
      log(`  ${Math.min(i + parallel, ranges.length)}/${ranges.length} chunks`)
  }
  return logs
}

const scanChain = async (chainId, { rpcs, factories }) => {
  const addresses = factories.map(([address]) => address)
  const from = Math.min(...factories.map(([, start]) => start))
  let lastError
  for (const url of rpcs)
    try {
      const head = Number(await call(url, 'eth_blockNumber', []))
      const to = head - MARGIN
      let logs
      try {
        // The whole range in one request first; 10k-block chunks on refusal.
        logs = await getLogs(url, addresses, from, to)
      } catch (err) {
        log(`  ${chainId}: wide scan refused (${err.message}); 10k chunks`)
        logs = await chunkedLogs(url, addresses, from, to, 10_000, 8)
      }
      const fresh = logs.filter((entry) => entry.topics?.[1])
      const blocks = [...new Set(fresh.map((entry) => Number(entry.blockNumber)))]
      const times = new Map()
      for (let i = 0; i < blocks.length; i += 10) {
        const slice = blocks.slice(i, i + 10)
        const replies = await Promise.all(
          slice.map((block) => call(url, 'eth_getBlockByNumber', [hex(block), false])),
        )
        replies.forEach((reply, index) =>
          times.set(slice[index], Number(reply.timestamp)),
        )
      }
      const created = {}
      for (const entry of fresh) {
        const address = `0x${entry.topics[1].slice(26)}`.toLowerCase()
        const time = times.get(Number(entry.blockNumber))
        if (!time) throw new Error(`No time for block ${entry.blockNumber}`)
        created[address] = Math.min(created[address] ?? time, time)
      }
      const sorted = Object.fromEntries(
        Object.entries(created).sort(([a], [b]) => a.localeCompare(b)),
      )
      return { scannedTo: to, created: sorted, logs: fresh.length }
    } catch (err) {
      lastError = err
      log(`  ${chainId}: ${url.includes(KEY) ? 'alchemy' : url} failed: ${err.message}`)
    }
  throw lastError
}

const snapshot = {}
for (const [chainId, config] of Object.entries(CHAINS)) {
  log(`chain ${chainId}`)
  const { logs, ...result } = await scanChain(chainId, config)
  snapshot[chainId] = result
  log(
    `  ${chainId}: ${Object.keys(result.created).length} lists from ${logs} logs, scannedTo ${result.scannedTo}`,
  )
}
writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`)
log(`wrote ${output}`)
