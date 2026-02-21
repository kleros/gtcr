import { gql } from 'graphql-request'

const PERMANENT_REGISTRY_QUERY = gql`
  query permanentRegistryQuery($lowerCaseTCRAddress: String!) {
    registry(id: $lowerCaseTCRAddress) {
      token
      numberOfSubmitted
      numberOfAbsent
      numberOfDisputed
      arbitrator {
        id
      }
      arbitrationSettings(orderBy: timestamp, orderDirection: desc) {
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
`

export default PERMANENT_REGISTRY_QUERY
