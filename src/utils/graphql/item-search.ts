import { gql } from 'graphql-request'

const ITEM_SEARCH_QUERY = gql`
  query itemSearchQuery($where: LItem_bool_exp!, $limit: Int) {
    itemSearch: LItem(limit: $limit, where: $where) {
      id
      itemID
      data
      props(order_by: { label: asc }) {
        type: itemType
        value
        isIdentifier
      }
      registry {
        id
      }
      requests(limit: 1, order_by: { submissionTime: desc }) {
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

export default ITEM_SEARCH_QUERY
