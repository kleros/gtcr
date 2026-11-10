import { gql, request } from 'graphql-request'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import type { RegistryKind } from 'pages/dashboard/types'

/*
 * The image field of the entries in Browse's activity rail. The dashboard
 * load reads two text fields per entry (and turns files into "IPFS file"),
 * so the picture is read here, for the handful of entries on screen. Light
 * entries carry their fields on the Curate indexer, Stake entries on their
 * subgraph; Classic entries keep theirs encoded in the item data, so they
 * show their list's logo instead.
 */

export interface EntryRef {
  chainId: number
  registryAddress: string
  itemID: string
  kind: RegistryKind
}

/** "<itemID>@<registry>", the id both indexers give an entry. */
export const entryKey = (entry: {
  registryAddress: string
  itemID: string
}): string => `${entry.itemID}@${entry.registryAddress}`.toLowerCase()

const LIGHT_ENTRY_IMAGES = gql`
  query BrowseEntryImages($ids: [String!]!, $chainId: Int!, $image: String!) {
    LItem(where: { id: { _in: $ids }, chainId: { _eq: $chainId } }) {
      id
      props(where: { itemType: { _eq: $image } }, limit: 1) {
        value
      }
    }
  }
`

const STAKE_ENTRY_IMAGES = gql`
  query BrowseStakeEntryImages($ids: [String!]!) {
    items(where: { id_in: $ids }) {
      id
      metadata {
        props {
          type
          value
        }
      }
    }
  }
`

type Prop = { type?: string | null; value?: string | null }

const firstImage = (props?: Prop[] | null): string | undefined =>
  props
    ?.find(
      (prop) =>
        (!prop.type || prop.type === ItemTypes.IMAGE) &&
        typeof prop.value === 'string' &&
        prop.value.trim() &&
        prop.value.trim() !== '-',
    )
    ?.value?.trim() ?? undefined

const group = (entries: EntryRef[], kind: RegistryKind) => {
  const byChain = new Map<number, string[]>()
  for (const entry of entries) {
    if (entry.kind !== kind) continue
    byChain.set(entry.chainId, [
      ...(byChain.get(entry.chainId) ?? []),
      entryKey(entry),
    ])
  }
  return [...byChain.entries()]
}

/** Image URI by entry key, for the entries that have one. */
export const fetchEntryImages = async (
  entries: EntryRef[],
): Promise<Record<string, string>> => {
  const images: Record<string, string> = {}
  const light = group(entries, 'light').map(async ([chainId, ids]) => {
    const url = subgraphUrl[chainId]
    if (!url) return
    const data = await request<{
      LItem: { id: string; props: Prop[] }[]
    }>(url, LIGHT_ENTRY_IMAGES, { ids, chainId, image: ItemTypes.IMAGE })
    for (const item of data.LItem) {
      const image = firstImage(
        item.props.map((prop) => ({ value: prop.value })),
      )
      if (image) images[item.id.toLowerCase()] = image
    }
  })
  const stake = group(entries, 'permanent').map(async ([chainId, ids]) => {
    const url = subgraphUrlPermanent[chainId]
    if (!url) return
    const data = await request<{
      items: { id: string; metadata?: { props?: Prop[] | null } | null }[]
    }>(url, STAKE_ENTRY_IMAGES, { ids })
    for (const item of data.items) {
      const image = firstImage(
        item.metadata?.props?.filter((prop) => prop.type === ItemTypes.IMAGE),
      )
      if (image) images[item.id.toLowerCase()] = image
    }
  })
  // One chain failing leaves its entries on their list's logo.
  await Promise.allSettled([...light, ...stake])
  return images
}
