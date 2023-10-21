import { gql } from '@apollo/client'

const LIGHT_ITEM_DETAILS_QUERY = gql`
  query lightItemDetailsQuery($id: String!) {
    litem(id: $id) {
      data
      itemID
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
        creationTx
        resolutionTx
        deposit
        disputeOutcome
        resolutionTime
        evidenceGroup {
          id
          evidences(orderBy: number, orderDirection: desc) {
            party
            title
            description
            fileURI
            number
            timestamp
            txHash
            fileTypeExtension
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
        }
      }
    }
  }
`

export default LIGHT_ITEM_DETAILS_QUERY
