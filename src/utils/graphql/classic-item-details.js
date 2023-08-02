import { gql } from '@apollo/client'

const CLASSIC_ITEM_DETAILS_QUERY = gql`
  query classicItemDetailsQuery($id: String!) {
    item(id: $id) {
      itemID
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

export default CLASSIC_ITEM_DETAILS_QUERY
