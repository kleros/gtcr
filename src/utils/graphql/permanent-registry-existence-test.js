import { gql } from '@apollo/client'

const PERMANENT_REGISTRY_EXISTENCE_TEST = gql`
  query PermanentRegistryExistenceTest($tcrAddress: String!) {
    registry(id: $tcrAddress) {
      id
    }
  }
`

export default PERMANENT_REGISTRY_EXISTENCE_TEST
