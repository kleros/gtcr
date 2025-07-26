import { gql } from '@apollo/client'

const PERMANENT_ITEM_DETAILS_QUERY = gql`
  query permanentItemDetailsQuery($id: String!) {
    item(id: $id) {
      data
      itemID
      status
      stake
      submitter
      includedAt
      arbitrationDeposit
      withdrawingTimestamp
      submissions(orderBy: createdAt, orderDirection: desc) {
        id
        createdAt
        creationTx
        finishedAt
        withdrawingTimestamp
        withdrawingTx
        submitter
        initialStake
        arbitrationDeposit
      }
      challenges(orderBy: createdAt, orderDirection: desc) {
        disputeID
        createdAt
        creationTx
        resolutionTime
        resolutionTx
        challenger
        challengerStake
        disputeOutcome
        arbitrationSetting {
          arbitratorExtraData
        }
        rounds(orderBy: creationTime, orderDirection: desc) {
          appealPeriodStart
          appealPeriodEnd
          ruling
          rulingTime
          hasPaidRequester
          hasPaidChallenger
          amountPaidRequester
          amountPaidChallenger
        }
      }
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
      registry {
        id
        token
        numberOfSubmitted
        numberOfAbsent
        numberOfDisputed
        arbitrator {
          id
        }
        arbitrationSettings {
          timestamp
          arbitratorExtraData
          metaEvidenceURI
          metadata {
            title
            description
            itemName
            itemNamePlural
            policyURI
            logoURI
            requireRemovalEvidence
          }
        }
        submissionMinDeposit
        submissionPeriod
        reinclusionPeriod
        withdrawingPeriod
        arbitrationParamsCooldown
        challengeStakeMultiplier
        winnerStakeMultiplier
        loserStakeMultiplier
        sharedStakeMultiplier
      }
    }
  }
`

export default PERMANENT_ITEM_DETAILS_QUERY
