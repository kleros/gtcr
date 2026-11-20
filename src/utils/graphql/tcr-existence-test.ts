import { gql } from 'graphql-request'

/* One indexer serves every chain and finds a list by its address alone, so
   the record also names the list's chain. */
const TCR_EXISTENCE_TEST = gql`
  query TcrExistenceTest($tcrAddress: String!) {
    lregistry: LRegistry_by_pk(id: $tcrAddress) {
      id
      chainId
    }
    registry: Registry_by_pk(id: $tcrAddress) {
      id
      chainId
    }
  }
`

export default TCR_EXISTENCE_TEST
