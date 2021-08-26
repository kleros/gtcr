import { gql } from '@apollo/client'

const REGISTRY_QUERY = gql`
  query registryQuery($lowerCaseTCRAddress: String!) {
    registry(id: $lowerCaseTCRAddress) {
      numberOfAbsent
      numberOfRegistered
      numberOfRegistrationRequested
      numberOfClearingRequested
      numberOfChallengedRegistrations
      numberOfChallengedClearing
    }
  }
`

export default REGISTRY_QUERY
