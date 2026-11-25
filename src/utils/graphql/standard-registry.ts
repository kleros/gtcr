import { gql } from 'graphql-request'

const STANDARD_REGISTRY_QUERY = gql`
  query standardRegistryQuery($lowerCaseTCRAddress: String!) {
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

export default STANDARD_REGISTRY_QUERY
