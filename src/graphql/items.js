import { gql } from '@apollo/client'

const ITEMS_QUERY = gql`
  query itemsQuery(
    $orderDirection: String
    $lowerCaseTCRAddress: String
    $skip: Int
    $first: Int
  ) {
    items(
      skip: $skip
      first: $first
      orderBy: latestRequestSubmissionTime
      orderDirection: $orderDirection
      where: { registry: $lowerCaseTCRAddress }
    ) {
      itemID
      status
      data
      props {
        value
      }
      requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        resolutionTime
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

export default ITEMS_QUERY
