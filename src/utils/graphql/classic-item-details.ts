import { gql } from 'graphql-request'

const CLASSIC_ITEM_DETAILS_QUERY = gql`
  query classicItemDetailsQuery($id: String!) {
    item: Item_by_pk(id: $id) {
      itemID
      data
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
        deposit
        disputeOutcome
        resolutionTime
        creationTx
        resolutionTx
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

export default CLASSIC_ITEM_DETAILS_QUERY
