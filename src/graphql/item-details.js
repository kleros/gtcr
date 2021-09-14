import { gql } from '@apollo/client'

const LIGHT_ITEM_DETAILS_QUERY = gql`
  query lightItemDetailsQuery($id: String!) {
    litem(id: $id) {
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

export default LIGHT_ITEM_DETAILS_QUERY
