import { parseRichAddress } from 'utils/rich-address'

/*
 * How a row names an entry from its fields, shared by the profile and the
 * site search (no other imports, so the app bar can carry it).
 */

/**
 * What names an entry in a row: a text value ("Binance · Hot Wallet 34"), or
 * an address shown short, with the network a rich address lives on.
 */
export interface EntryName {
  text: string
  /** The name is an address: set in mono, the full value in `fields`. */
  address?: boolean
  /** The whole address `text` shortens, when the name is one. */
  value?: string
  /** The network of a rich address ("Polygon Mainnet"). */
  network?: string
  /**
   * The EVM chain a rich address names (eip155); null for a rich address on
   * any other network. Absent for a plain address, which lives on the
   * entry's own chain.
   */
  chainId?: number | null
  /**
   * The title of the list that address is, when the registry index knows
   * it: an entry of a list of lists (Verified Registries) is itself a list.
   */
  list?: string
}

export interface EntryProp {
  label: string
  value: string
  type: string
  identifier: boolean
}

/** Field types that cannot name an entry in a line of text. */
const PICTURE_TYPES = new Set(['image', 'file'])
const TEXT_TYPES = new Set(['text', 'long text'])

export const oneLine = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

const isIpfs = (value: string) =>
  value.startsWith('/ipfs/') || value.startsWith('ipfs://')

const shortValue = (value: string) =>
  value.length > 11 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value

const byLabel = (a: EntryProp, b: EntryProp) =>
  a.label.localeCompare(b.label, 'en')

/**
 * The entry's name, a name before an address as on the list page (which
 * leads with its first text column): up to two of its text identifiers, in
 * label order ("Nakamoto Games · BalanceVault"), since the indexer returns
 * an entry's fields in no column order, so the pair can lead with another
 * identifier than the list page does; else its first identifier,
 * an address shown short with its network; else the first value that is not
 * a picture. Never an image or a file: on some lists the only picture is a
 * proof screenshot, which names nothing.
 */
export const nameEntry = (
  props: EntryProp[],
): { entry?: EntryName; fields?: string[] } => {
  const usable = props.filter(
    (prop) =>
      prop.value && !PICTURE_TYPES.has(prop.type) && !isIpfs(prop.value),
  )
  const identifiers = usable.filter((prop) => prop.identifier)
  const fields =
    identifiers.length > 0
      ? identifiers.map((prop) => `${prop.label}: ${prop.value}`)
      : undefined
  const texts = identifiers
    .filter((prop) => TEXT_TYPES.has(prop.type))
    .sort(byLabel)
  if (texts.length > 0)
    return {
      entry: {
        text: texts
          .slice(0, 2)
          .map((prop) => prop.value)
          .join(' · '),
      },
      fields,
    }
  const [first] = identifiers.length > 0 ? identifiers : usable
  if (!first) return {}
  if (first.type === 'rich address') {
    const rich = parseRichAddress(first.value)
    // A network this app does not know still names the address itself.
    const address = rich?.address ?? first.value.split(':').pop() ?? ''
    if (address)
      return {
        entry: {
          text: shortValue(address),
          address: true,
          value: address,
          network: rich?.reference.name,
          chainId:
            rich?.reference.namespaceId === 'eip155'
              ? Number(rich.reference.id)
              : null,
        },
        fields,
      }
  }
  if (first.type === 'address' || /^0x[0-9a-fA-F]{40}$/.test(first.value))
    return {
      entry: {
        text: shortValue(first.value),
        address: true,
        value: first.value,
      },
      fields,
    }
  return { entry: { text: first.value }, fields }
}
