import { gql } from '@apollo/client'

const ITEM_SEARCH_QUERY = gql`
  query itemSearchQuery($text: String!) {
    itemSearch(text: $text, first: $first) {
      id
      itemID
      data
      props {
        type
        value
        isIdentifier
      }
      registry {
        id
      }
      requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        resolutionTime
        deposit
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
`

export default ITEM_SEARCH_QUERY
