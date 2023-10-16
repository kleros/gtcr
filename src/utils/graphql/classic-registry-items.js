// fetch the items belonging to a classic registry

import { gql } from '@apollo/client'

const CLASSIC_REGISTRY_ITEMS_QUERY = gql`
  query classicRegistryItemsQuery(
    $skip: Int
    $first: Int
    $orderDirection: OrderDirection
    $where: Item_filter
  ) {
    items(
      skip: $skip
      first: $first
      orderDirection: $orderDirection
      orderBy: latestRequestSubmissionTime
      where: $where
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
        deposit
        rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
          appealed
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
`

export default CLASSIC_REGISTRY_ITEMS_QUERY
