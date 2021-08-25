import { gql } from '@apollo/client'

export const ITEM_DETAILS_QUERY = gql`
  query itemDetailsQuery($id: String!) {
    item(id: $id) {
      data
      requests(orderBy: submissionTime, orderDirection: desc) {
        requestType
        disputed
        disputeID
        submissionTime
        resolved
        requester
        arbitrator
        challenger
        evidenceGroupID
        creationTx
        resolutionTx
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
