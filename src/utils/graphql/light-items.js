import { gql } from '@apollo/client'

const LIGHT_ITEMS_QUERY = gql`
  query lightItemsQuery(
    $skip: Int
    $first: Int
    $orderDirection: OrderDirection
    $where: LItem_filter
  ) {
    litems(
      skip: $skip
      first: $first
      orderDirection: $orderDirection
      orderBy: latestRequestSubmissionTime
      where: $where
    ) {
      itemID
      status
      data
      props {
        value
        type
        label
        description
        isIdentifier
      }
      requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        resolutionTime
        requestType
        arbitrator
        evidenceGroupID
        creationTx
        resolutionTx
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

export default LIGHT_ITEMS_QUERY
