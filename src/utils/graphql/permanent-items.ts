import { gql } from 'graphql-request'

const PERMANENT_ITEMS_QUERY = gql`
  query permanentItemsQuery(
    $skip: Int
    $first: Int
    $orderDirection: OrderDirection
    $where: Item_filter
  ) {
    items(
      skip: $skip
      first: $first
      orderDirection: $orderDirection
      orderBy: includedAt
      where: $where
    ) {
      itemID
      status
      data
      arbitrationDeposit
      withdrawingTimestamp
      metadata {
        props {
          value
          type
          label
          description
          isIdentifier
        }
      }
      createdAt
      includedAt
      stake
      arbitrationDeposit
      submissions(first: 1, orderBy: createdAt, orderDirection: desc) {
        submitter
        finishedTx
        withdrawingTx
      }
      challenges(first: 1, orderBy: createdAt, orderDirection: desc) {
        disputeID
        createdAt
        resolutionTime
        resolutionTx
        challenger
        challengerStake
        disputeOutcome
        rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
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
    }
  }
`

export default PERMANENT_ITEMS_QUERY

/**
 * The entries of a Stake list that have been challenged at least once (each
 * challenge is a dispute), whatever their status now (round 6, "previously
 * disputed"): their ids only, for the status menu's count; a lower bound
 * when the read reaches its limit.
 */
export const PERMANENT_DISPUTED_BEFORE_QUERY = gql`
  query permanentDisputedBeforeQuery($registry: String!, $first: Int!) {
    items(
      first: $first
      where: { registry: $registry, challenges_: { id_not: null } }
    ) {
      id
    }
  }
`
