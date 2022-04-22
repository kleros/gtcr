import { gql } from '@apollo/client'

const TCR_EXISTENCE_TEST = gql`
  query TcrExistenceTest($tcrAddress: String!) {
    lregistry(id: $tcrAddress) {
      id
    }
  }
`

export default TCR_EXISTENCE_TEST
