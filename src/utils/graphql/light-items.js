import { gql } from '@apollo/client'

const LIGHT_ITEMS_QUERY = gql`
  query lightItemsQuery(
    $offset: Int
    $limit: Int
    $order_by: [LItem_order_by!]
    $where: LItem_bool_exp
    $registryId: String!
  ) {
    lregistry: LRegistry_by_pk(id: $registryId) {
      numberOfAbsent
      numberOfRegistered
      numberOfRegistrationRequested
      numberOfClearingRequested
      numberOfChallengedRegistrations
      numberOfChallengedClearing
    }
    litems: LItem(
      offset: $offset
      limit: $limit
      order_by: $order_by
      where: $where
    ) {
      itemID
      status
      data
      props(order_by: { label: asc }) {
        value
        type: itemType
        label
        description
        isIdentifier
      }
      requests(limit: 1, order_by: { submissionTime: desc }) {
        requestType
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        resolutionTime
        deposit
        rounds(limit: 1, order_by: { creationTime: desc }) {
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

export default LIGHT_ITEMS_QUERY
