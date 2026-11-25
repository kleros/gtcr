import { gql } from 'graphql-request'

const STANDARD_ITEMS_QUERY = gql`
  query standardItemsQuery(
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

export default STANDARD_ITEMS_QUERY

/**
 * The entries of a list that have been to court at least once, whatever
 * their status now (round 6, "previously disputed"): their ids only, for
 * the status menu's count. The indexer has no aggregate, so the count is
 * the length of this read, a lower bound when it reaches the limit.
 */
export const STANDARD_DISPUTED_BEFORE_QUERY = gql`
  query standardDisputedBeforeQuery($registryId: String!, $limit: Int!) {
    litems: LItem(
      limit: $limit
      where: {
        registry_id: { _eq: $registryId }
        requests: { disputed: { _eq: true } }
      }
    ) {
      itemID
    }
  }
`
