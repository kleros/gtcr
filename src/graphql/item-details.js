import { gql } from '@apollo/client'

export const ITEM_DETAILS_QUERY = gql`
  query itemDetailsQuery($tcrAddress: String!, $itemID: String!) {
    items(
      first: 1
      orderBy: latestRequestSubmissionTime
      orderDirection: desc
      where: { registry: $tcrAddress, itemID: $itemID }
    ) {
      itemID
      status
      registry {
        id
      }
      data
      requests(orderBy: submissionTime, orderDirection: desc) {
        disputed
        disputeID
        submissionTime
        resolved
        requester
        arbitrator
        challenger
        rounds(orderBy: creationTime, orderDirection: desc) {
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
