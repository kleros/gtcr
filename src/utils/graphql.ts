import { gql } from '@apollo/client'

export const CLASSIC_REGISTRY_ITEMS_QUERY = gql`
  query classicRegistryItemsQuery(
    $skip: Int
    $first: Int
    $orderDirection: OrderDirection
    $where: Item_filter
  ) {
    items(
      skip: $skip
      first: $first
      orderDirection: $orderDirection
      orderBy: latestRequestSubmissionTime
      where: $where
    ) {
      itemID
      status
      data
      requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
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
export const LIGHT_ITEM_DETAILS_QUERY = gql`
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

export const ITEM_SEARCH_QUERY = gql`
  query itemSearchQuery($text: String!) {
    itemSearch(text: $text, first: $first) {
      id
      itemID
      data
      props {
        type
        value
        isIdentifier
      }
      registry {
        id
      }
    }
  }
`

export const LIGHT_ITEMS_QUERY = gql`
  query lightItemsQuery(
    $skip: Int
    $first: Int
    $orderDirection: OrderDirection
    $where: LItem_filter
  ) {
    litems(
      skip: $skip
      first: $first
      orderDirection: $orderDirection
      orderBy: latestRequestSubmissionTime
      where: $where
    ) {
      id
      itemID
      status
      data
      numberOfRequests
      props {
        value
        type
        label
        description
        isIdentifier
      }
      requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
        disputed
        disputeID
        submissionTime
        resolved
        requester
        challenger
        resolutionTime
        requestType
        arbitrator
        arbitratorExtraData
        evidenceGroupID
        creationTx
        resolutionTx
        numberOfRounds
        rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
          appealCost
          appealPeriodStart
          appealPeriodEnd
          disputeStatus
          ruling
          feeRewards
          hasPaidRequester
          hasPaidChallenger
          amountPaidRequester
          amountPaidChallenger
        }
      }
    }
  }
`

export const LIGHT_REGISTRY_QUERY = gql`
  query lightRegistryQuery($lowerCaseTCRAddress: String!) {
    lregistry(id: $lowerCaseTCRAddress) {
      numberOfAbsent
      numberOfRegistered
      numberOfRegistrationRequested
      numberOfClearingRequested
      numberOfChallengedRegistrations
      numberOfChallengedClearing
    }
  }
`

export const GQL_META_EVIDENCES = gql`
  query FetchMetaEvidences($tcrAddress: String!) {
    metaEvidences(where: { tcrAddress: $tcrAddress }) {
      id
      timestamp
      URI
    }
  }
`
export const TCR_EXISTENCE_TEST = gql`
  query TcrExistenceTest($tcrAddress: String!) {
    lregistry(id: $tcrAddress) {
      id
    }
    registry(id: $tcrAddress) {
      id
    }
  }
`
