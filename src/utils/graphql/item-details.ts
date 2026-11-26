import { gql } from 'graphql-request'

const STANDARD_ITEM_DETAILS_QUERY = gql`
  query standardItemDetailsQuery($id: String!) {
    litem: LItem_by_pk(id: $id) {
      data
      itemID
      status
      disputed
      props {
        value
        type: itemType
        label
        description
        isIdentifier
      }
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
        challengeTime
        txHashChallenge
        # The file the request was made under: its dispute's choices are
        # named by its ruling titles.
        metaEvidence {
          uri
        }
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
        # A challenge in the submission's block ties round 0 and round 1 on
        # creationTime; their ids (…-0, …-1) break the tie.
        rounds(order_by: [{ creationTime: desc }, { id: desc }]) {
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

export default STANDARD_ITEM_DETAILS_QUERY
