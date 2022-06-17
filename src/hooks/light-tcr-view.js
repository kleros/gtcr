import { useState, useEffect, useMemo } from 'react'
import { gql, useLazyQuery } from '@apollo/client'
import { LIGHT_ITEMS_QUERY } from 'utils/graphql'
import { ITEMS_PER_PAGE, ORDER_DIR } from 'utils/constants'
import { ITEM_STATUS_CODES, RULING_CODES } from 'utils/constants/subgraph'
import { bigNumberify } from 'ethers/utils'

const lightCurateQuery = gql`
  query FetchAllInfoForLightCurate($tcrAddress: String!) {
    lregistry(id: $tcrAddress) {
      id
      connectedTCR
      submissionDeposit
      submissionBaseDeposit
      submissionChallengeDeposit
      removalDeposit
      removalBaseDeposit
      removalChallengeDeposit
      arbitrationCost
      challengePeriodDuration
      numberOfAbsent
      numberOfRegistered
      numberOfRegistrationRequested
      numberOfClearingRequested
      numberOfChallengedRegistrations
      numberOfChallengedClearing
      sharedStakeMultiplier
      winnerStakeMultiplier
      loserStakeMultiplier
      MULTIPLIER_DIVISOR
    }
    metaEvidences(where: { tcrAddress: $tcrAddress }) {
      id
      timestamp
      URI
      tcrAddress
    }
  }
`

const useLightTcrView = tcrAddress => {
  const [metaEvidence, setMetaEvidence] = useState(null)
  const [regData, setRegData] = useState({})
  const [error, setError] = useState()

  const [itemsWhere, setItemsWhere] = useState({
    registry: tcrAddress
  })
  const [page, setPage] = useState(1)
  const [orderDir, setOrderDir] = useState(ORDER_DIR.asc)

  const [
    execRegQuery,
    { data: regQueryResult, loading: loadingRegistry }
  ] = useLazyQuery(lightCurateQuery)

  const [
    execLightItemsQuery,
    { loading: loadingItems, data: itemsRawData }
  ] = useLazyQuery(LIGHT_ITEMS_QUERY)

  const loading = useMemo(
    () => loadingItems || loadingRegistry || !regQueryResult || !itemsRawData,
    [loadingItems, loadingRegistry, regQueryResult, itemsRawData]
  )

  useEffect(() => {
    if (loadingRegistry || !regQueryResult) return

    const handleRegistryQuery = async () => {
      const metaEvidences = regQueryResult.metaEvidences
      const metaEvidence = metaEvidences[metaEvidences.length - 2]
      try {
        const ipfsURI = process.env.REACT_APP_IPFS_GATEWAY + metaEvidence.URI
        const res = await fetch(ipfsURI)
        const data = await res.json()

        setMetaEvidence({
          ...metaEvidence,
          ...data
        })
      } catch (err) {
        setError(err)
        console.error(err)
      }
    }

    handleRegistryQuery()
    setRegData(regQueryResult.lregistry)
  }, [loadingRegistry, regQueryResult])

  useEffect(() => {
    execRegQuery({
      variables: {
        tcrAddress
      }
    })

    execLightItemsQuery({
      variables: {
        skip: (page - 1) * ITEMS_PER_PAGE,
        first: ITEMS_PER_PAGE,
        orderDirection: orderDir,
        where: {
          ...itemsWhere,
          registry: tcrAddress
        }
      }
    })
  }, [
    page,
    itemsWhere,
    orderDir,
    tcrAddress,
    execLightItemsQuery,
    execRegQuery
  ])

  const items = useMemo(() => {
    if (loading || !metaEvidence) return []

    return itemsRawData.litems.map(item => {
      const { itemID, status, requests, data, props, numberOfRequests } = item
      const latestRequest =
        requests[Number(numberOfRequests) - 1] || requests[0]
      const latestRound =
        latestRequest.rounds[Number(latestRequest.numberOfRounds) - 1] ||
        latestRequest.rounds[0]
      const { disputed, disputeID, submissionTime } = latestRequest
      const {
        appealCost,
        appealPeriodStart,
        appealPeriodEnd,
        ruling,
        hasPaidRequester,
        hasPaidChallenger,
        amountPaidRequester,
        amountPaidChallenger,
        disputeStatus
      } = latestRound
      const decodedData = props.map(({ value }) => value)

      return {
        ID: itemID,
        itemID,
        data,
        status: ITEM_STATUS_CODES[status],
        decodedData,
        mergedData: props,
        columns: metaEvidence.metadata.columns.map((col, i) => ({
          value: decodedData[i],
          ...col
        })),
        requests,
        latestRequest,
        latestRound,
        disputeStatus,
        disputed,
        disputeID,
        submissionTime: bigNumberify(submissionTime),
        hasPaid: [false, hasPaidRequester, hasPaidChallenger],
        currentRuling: RULING_CODES[ruling],
        appealCost: bigNumberify(appealCost),
        appealStart: bigNumberify(appealPeriodStart),
        appealEnd: bigNumberify(appealPeriodEnd),
        amountPaid: [
          bigNumberify(0),
          bigNumberify(amountPaidRequester),
          bigNumberify(amountPaidChallenger)
        ],
        errors: []
      }
    })
  }, [loading, metaEvidence, itemsRawData])

  return {
    loading,
    items,
    metaEvidence,
    tcrAddress,
    regData,
    error,
    page,
    setPage,
    itemsWhere,
    setItemsWhere,
    orderDir,
    setOrderDir
  }
}

export default useLightTcrView
