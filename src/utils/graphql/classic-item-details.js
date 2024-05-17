import { gql } from '@apollo/client'

const CLASSIC_ITEM_DETAILS_QUERY = gql`
  query classicItemDetailsQuery($id: String!) {
    item(id: $id) {
      itemID
      data
      status
      disputed
      requests(orderBy: submissionTime, orderDirection: desc) {
        requestType
        disputed
        disputeID
        submissionTime
        resolved
        requester
        arbitrator
        arbitratorExtraData
        challenger
        deposit
        disputeOutcome
        resolutionTime
        creationTx
        resolutionTx
        evidenceGroup {
          id
          evidences(orderBy: number, orderDirection: desc) {
            party
            URI
            number
            timestamp
            txHash
            metadata {
              name
              title
              description
              fileURI
              fileTypeExtension
            }
          }
        }
        rounds(orderBy: creationTime, orderDirection: desc) {
          appealed
          appealPeriodStart
          appealPeriodEnd
          ruling
          hasPaidRequester
          hasPaidChallenger
          amountPaidRequester
          amountPaidChallenger
          txHashAppealPossible
          appealedAt
          txHashAppealDecision
        }
      }
    }
  }
`

export default CLASSIC_ITEM_DETAILS_QUERY
