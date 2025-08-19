import { gql } from '@apollo/client'

const LIGHT_REGISTRY_QUERY = gql`
  query lightRegistryQuery($lowerCaseTCRAddress: String!) {
    lregistry: LRegistry_by_pk(id: $lowerCaseTCRAddress) {
      numberOfAbsent
      numberOfRegistered
      numberOfRegistrationRequested
      numberOfClearingRequested
      numberOfChallengedRegistrations
      numberOfChallengedClearing
    }
  }
`

export default LIGHT_REGISTRY_QUERY
