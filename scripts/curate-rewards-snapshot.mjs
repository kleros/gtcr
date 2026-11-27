// Reads every month of Curate rewards that rewards.kleros.io publishes and
// writes the snapshot pages/dashboard/rewards.ts ships with: every address
// ever paid, then each month's period, chain, file, total and the addresses
// it paid (as places in that list). The index lists one file per month on
// IPFS, so a listed month never changes; a browser reads only the index
// (about 2 KB) and the months published since this snapshot.
// Run it now and then (e.g. before a release):
//   node scripts/curate-rewards-snapshot.mjs
// It writes src/config/curate-rewards-snapshot.json, relative to this script.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REWARDS_INDEX = 'https://rewards.kleros.io/curate-rewards.json'

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const PERIOD = /^\d{4}-\d{2}$/
const WEI = /^\d+$/
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * A month's period, chain, total (PNK wei as a decimal string) and the
 * addresses paid, or null when the file is not a curate-rewards/v1 month:
 * the reading of monthFromFile in src/pages/dashboard/rewards.ts
 * (rewards.test.ts holds the two to the same answers).
 */
export const monthFromFile = (url, file) => {
  if (file?.schema !== 'curate-rewards/v1') return null
  const period = file.period?.label
  const total = file.totals?.total
  const chainId = file.chainId
  if (typeof period !== 'string' || !PERIOD.test(period)) return null
  if (typeof total !== 'string' || !WEI.test(total)) return null
  if (!Number.isInteger(chainId) || chainId <= 0) return null
  const recipients =
    file.recipients &&
    typeof file.recipients === 'object' &&
    !Array.isArray(file.recipients)
      ? Object.keys(file.recipients)
          .filter((key) => ADDRESS.test(key))
          .map((key) => key.toLowerCase())
      : []
  return { period, chainId, url, total, recipients }
}

const readJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

const main = async () => {
  const output = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../src/config/curate-rewards-snapshot.json',
  )
  const index = await readJson(REWARDS_INDEX)
  if (!Array.isArray(index)) throw new Error('The rewards index is not a list')
  const read = []
  for (let i = 0; i < index.length; i += 6) {
    const slice = index.slice(i, i + 6)
    const files = await Promise.all(slice.map(readJson))
    files.forEach((file, at) => {
      const month = monthFromFile(slice[at], file)
      if (!month) throw new Error(`${slice[at]}: not a curate-rewards/v1 month`)
      read.push(month)
    })
  }
  read.sort((a, b) => byCodeUnit(a.period, b.period))
  const curators = [
    ...new Set(read.flatMap((month) => month.recipients)),
  ].sort(byCodeUnit)
  const place = new Map(curators.map((address, at) => [address, at]))
  const months = read.map(({ recipients, ...month }) => ({
    ...month,
    paid: recipients.map((address) => place.get(address)),
  }))
  writeFileSync(
    output,
    `${JSON.stringify({ index: REWARDS_INDEX, curators, months }, null, 2)}\n`,
  )
  console.log(
    `wrote ${months.length} months (${months[0]?.period} to ${months.at(-1)?.period}) and ${curators.length} curators to ${output}`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
