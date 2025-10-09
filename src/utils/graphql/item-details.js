import { gql } from '@apollo/client'

const LIGHT_ITEM_DETAILS_QUERY = gql`
  query lightItemDetailsQuery($id: String!) {
    litem: LItem_by_pk(id: $id) {
      data
      itemID
      status
      disputed
      requests(order_by: { submissionTime: desc }) {
        requestType
        disputed
        disputeID
        submissionTime
        resolved
        requester
        arbitrator
        arbitratorExtraData
        challenger
        creationTx
        resolutionTx
        deposit
        disputeOutcome
        resolutionTime
        evidenceGroup {
          id
          evidences(order_by: { number: desc }) {
            party
            uri
            number
            timestamp
            txHash
            name
            title
            description
            fileURI
            fileTypeExtension
          }
        }
        rounds(order_by: { creationTime: desc }) {
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

export default LIGHT_ITEM_DETAILS_QUERY
