import { useState, useEffect, useMemo } from 'react'
import { useLazyQuery } from '@apollo/client'
import { GQL_LIGHT_TCR, LIGHT_ITEMS_QUERY } from 'utils/graphql'
import { ITEMS_PER_PAGE, ORDER_DIR } from 'utils/constants'
import { ITEM_STATUS_CODES, RULING_CODES } from 'utils/constants/subgraph'
import { bigNumberify } from 'ethers/utils'

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
  ] = useLazyQuery(GQL_LIGHT_TCR)

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
      const { itemID, status, requests, data, props } = item
      const latestRequest = requests[0] // requests is ordered desc
      const { rounds } = latestRequest
      const latestRound = rounds[0] // rounds is ordered desc
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
