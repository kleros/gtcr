import { useMemo, useRef } from 'react'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import {
  ipfsPath,
  readRegistryMetadata,
  type RegistryMetadata,
} from 'utils/registry-metadata'
import type { DashboardRegistry } from 'pages/dashboard/types'
import { hasAddressTitle, registryBlurb } from './view'

/*
 * The dashboard load reads list metadata (titles, logos) for a bounded set
 * of lists, with a short timeout, and again on every refresh. Lists outside
 * that set, lists whose MetaEvidence URI has no leading slash ("ipfs/Qm…")
 * and lists whose read timed out reached Browse without their title or
 * logo. Two hooks complete them from their own MetaEvidence:
 *
 * - useNamedRegistries gives every list known only by its address its real
 *   title, before Browse filters and sorts, so search and "Name A to Z" use
 *   the name the row shows (about 60 small reads, kept for the session);
 * - useCompletedRegistries fills the logo and description of the lists on
 *   screen, and keeps what a list once had so a refresh that misses it does
 *   not blank it.
 *
 * Both read through the same query keys, so a file is fetched once.
 */

/** What a list can still get from its MetaEvidence ("-" is no description). */
const isIncomplete = (registry: DashboardRegistry): boolean =>
  !registry.logoURI || !registryBlurb(registry) || hasAddressTitle(registry)

const pathsOf = (registries: DashboardRegistry[]): string[] => [
  ...new Set(
    registries
      .map((registry) => ipfsPath(registry.metadataURI))
      .filter((path): path is string => !!path),
  ),
]

// Stable, so react-query keeps the combined result until a read changes.
const combineReads = (
  results: UseQueryResult<RegistryMetadata | null>[],
): Array<RegistryMetadata | null | undefined> =>
  results.map((result) => result.data)

/** Metadata by MetaEvidence path, for the paths read so far. */
const useMetadataReads = (paths: string[]): Map<string, RegistryMetadata> => {
  const reads = useQueries({
    queries: paths.map((path) => ({
      queryKey: ['registryMetadata', path],
      queryFn: () => readRegistryMetadata(path),
      // Content-addressed: it never changes.
      staleTime: Infinity,
      gcTime: 60 * 60_000,
      retry: 2,
    })),
    combine: combineReads,
  })
  return useMemo(() => {
    const byPath = new Map<string, RegistryMetadata>()
    reads.forEach((read, index) => {
      if (read && paths[index]) byPath.set(paths[index], read)
    })
    return byPath
  }, [reads, paths])
}

/**
 * The lists, with a real title for each one the indexer only knew by its
 * address. Feed this to the filters and sorts: they then match and order by
 * the name the row shows.
 */
export const useNamedRegistries = (
  registries: DashboardRegistry[],
): DashboardRegistry[] => {
  const paths = useMemo(
    () => pathsOf(registries.filter(hasAddressTitle)),
    [registries],
  )
  const byPath = useMetadataReads(paths)
  return useMemo(
    () =>
      registries.map((registry) => {
        if (!hasAddressTitle(registry)) return registry
        const path = ipfsPath(registry.metadataURI)
        const read = path ? byPath.get(path) : undefined
        if (!read?.title) return registry
        return {
          ...registry,
          title: read.title,
          description: registryBlurb(registry)
            ? registry.description
            : read.description || registry.description,
          logoURI: registry.logoURI || read.logoURI,
        }
      }),
    [registries, byPath],
  )
}

/**
 * The lists on screen, completed with what their MetaEvidence holds: the
 * logo, the title when the indexer only had the address, the description.
 * Values the indexer gave are kept.
 */
export const useCompletedRegistries = (
  registries: DashboardRegistry[],
): ((registry: DashboardRegistry) => DashboardRegistry) => {
  // What each list has had: a refresh whose metadata read timed out does
  // not take a logo away again.
  const known = useRef(new Map<string, RegistryMetadata>())
  for (const registry of registries) {
    const previous = known.current.get(registry.id) ?? {}
    known.current.set(registry.id, {
      logoURI: registry.logoURI || previous.logoURI,
      description: registryBlurb(registry) ?? previous.description,
      title: hasAddressTitle(registry) ? previous.title : registry.title,
    })
  }

  const paths = useMemo(
    () => pathsOf(registries.filter(isIncomplete)),
    [registries],
  )
  const byPath = useMetadataReads(paths)

  return (registry) => {
    const path = ipfsPath(registry.metadataURI)
    const read = (path && byPath.get(path)) || {}
    const kept = known.current.get(registry.id) ?? {}
    const title = hasAddressTitle(registry)
      ? kept.title || read.title
      : registry.title
    return {
      ...registry,
      title: title || registry.title,
      description:
        registryBlurb(registry) ??
        kept.description ??
        read.description ??
        registry.description,
      logoURI: registry.logoURI || kept.logoURI || read.logoURI,
    }
  }
}
