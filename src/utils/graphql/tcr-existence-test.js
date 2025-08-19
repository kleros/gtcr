import { gql } from '@apollo/client'

const TCR_EXISTENCE_TEST = gql`
  query TcrExistenceTest($tcrAddress: String!) {
    lregistry: LRegistry_by_pk(id: $tcrAddress) {
      id
    }
    registry: Registry_by_pk(id: $tcrAddress) {
      id
    }
  }
`

export default TCR_EXISTENCE_TEST
