import { gql } from '@apollo/client'

const PERMANENT_ITEMS_QUERY = gql`
  query permanentItemsQuery(
    $skip: Int
    $first: Int
    $orderDirection: OrderDirection
    $where: Item_filter
    $registryId: String
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
      }
      challenges(first: 1, orderBy: createdAt, orderDirection: desc) {
        disputeID
        createdAt
        resolutionTime
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
