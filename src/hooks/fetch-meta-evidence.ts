import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { request } from 'utils/indexer-request'

/**
 * The MetaEvidence of any list an entry names (a list of lists' row, a
 * badge): Light, Stake, or a Classic list still referenced by a Light one.
 * Classic lists have no page of their own any more (pages/classic-retired),
 * but a Light list of lists can still hold one, and its row is named from
 * this file. Nothing else of a Classic list is read.
 */
export const fetchMetaEvidence = async (
  tcr: string,
  networkId: number,
): Promise<FetchMetaEvidenceResult | null> => {
  // The address travels as a variable: it can come from an entry's own
  // field (a list reference), and glued into the query text it would be
  // query text written by that entry, sent from every visitor's browser.
  const id = tcr.toLowerCase()
  const envioQuery = {
    query: `query RegistryMetaEvidence($id: String!) {
    registry:Registry_by_pk(id: $id) {
      registrationMetaEvidence {
        uri
      }
      connectedTCR
    }
    lregistry:LRegistry_by_pk(id: $id) {
      registrationMetaEvidence {
        uri
      }
      connectedTCR
    }
  }`,
    variables: { id },
  }

  const pgtcrQuery = {
    query: `query StakeRegistryMetaEvidence($id: ID!) {
    registry(id: $id) {
      arbitrationSettings(orderBy: timestamp, orderDirection: desc, first: 1) {
        metaEvidenceURI
      }
    }
  }`,
    variables: { id },
  }

  // A failed read is thrown, not turned into "no metadata": the queries that
  // ask keep their answer for a day, so a swallowed failure left the page on
  // its skeleton (and a list-of-lists row without its name) until a reload.
  // Thrown, React Query retries it.

  // 1. Envio first (fast): Light lists, and Classic ones a Light list still
  // names. It travels with the page's other indexer reads
  // (utils/indexer-request.ts): a list of lists asks this once per row.
  const envioData = await request(
    subgraphUrl[networkId]!,
    envioQuery.query,
    envioQuery.variables,
  )
  if (envioData?.registry)
    return {
      metaEvidenceURI: envioData.registry.registrationMetaEvidence.uri,
      connectedTCR: envioData.registry.connectedTCR,
    }
  if (envioData?.lregistry)
    return {
      metaEvidenceURI: envioData.lregistry.registrationMetaEvidence.uri,
      connectedTCR: envioData.lregistry.connectedTCR,
    }

  // 2. Only try Goldsky if Envio didn't find it (rare — permanent TCRs).
  const permanentUrl = subgraphUrlPermanent[networkId]
  if (!permanentUrl) return null
  const pgtcrData = await request(
    permanentUrl,
    pgtcrQuery.query,
    pgtcrQuery.variables,
  )
  return pgtcrData?.registry?.arbitrationSettings?.[0]?.metaEvidenceURI
    ? {
        metaEvidenceURI:
          pgtcrData.registry.arbitrationSettings[0].metaEvidenceURI,
      }
    : null
}
