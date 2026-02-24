import { gql } from 'graphql-request'

const CLASSIC_REGISTRY_ITEMS_QUERY = gql`
  query classicRegistryItemsQuery(
    $offset: Int
    $limit: Int
    $order_by: [Item_order_by!]
    $where: Item_bool_exp
  ) {
    items: Item(
      offset: $offset
      limit: $limit
      order_by: $order_by
      where: $where
    ) {
      itemID
      status
      data
      requests(limit: 1, order_by: { submissionTime: desc }) {
        requestType
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        deposit
        rounds(limit: 1, order_by: { creationTime: desc }) {
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
