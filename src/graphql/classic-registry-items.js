// fetch the items belonging to a classic registry

import { gql } from '@apollo/client'

const CLASSIC_REGISTRY_ITEMS_QUERY = gql`
  query classicRegistryItemsQuery(
    $lowercaseRegistryId: ID!
    $orderDirection: OrderDirection
  ) {
    registry(id: $lowercaseRegistryId) {
      items(
        first: 1000
        orderBy: latestRequestSubmissionTime
        orderDirection: $orderDirection
      ) {
        itemID
        status
        data
        requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
          disputed
          disputeID
          submissionTime
          resolved
          requester
          challenger
          rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
            appealPeriodStart
            appealPeriodEnd
            ruling
            hasPaidRequester
            hasPaidChallenger
            amountPaidRequester
            amountPaidChallenger
          }
        }
      }
    }
  }
`

export default CLASSIC_REGISTRY_ITEMS_QUERY
