import { useState, useEffect, useMemo } from 'react'
import { useLazyQuery } from '@apollo/client'
import { GQL_LIGHT_TCR, LIGHT_ITEMS_QUERY } from 'utils/graphql'
import {
  DEFAULT_FILTER_VALUES,
  FILTER_STATUS,
  ITEMS_PER_PAGE,
  ORDER_DIR
} from 'utils/constants'
import { ITEM_STATUS_CODES, RULING_CODES } from 'utils/constants/subgraph'
import { bigNumberify } from 'ethers/utils'
import {
  LItem,
  LItemProp,
  LRegistry,
  LRequest,
  MetadataColumn,
  MetaEvidence
} from 'types/schema'
import { toKError } from 'utils/helpers'
import { useHistory } from 'react-router'
import useTcrParams from './use-tcr-params'
import QueryString from 'qs'

export type LightTcrContext = {
  loading: boolean
  items: LItem[]
  metaEvidence: MetaEvidence | undefined
  tcrAddress: string
  regData: LRegistry | undefined
  error: KError | undefined
}

export type ItemsWhere = {
  registry: string
  status?: string
  disputed?: boolean
}

const useLightTcrContext = (): LightTcrContext => {
  const history = useHistory()
  const { tcrAddress, itemID } = useTcrParams()

  const [metaEvidence, setMetaEvidence] = useState<MetaEvidence>()
  const [regData, setRegData] = useState<LRegistry>({} as LRegistry)
  const [error, setError] = useState<KError>()

  const queryParams = useMemo(() => {
    const qs = QueryString.parse(history.location.search.replace(/\?/g, ''))
    return Object.keys(qs).reduce(
      (params, key) => ({
        ...params,
        [key]: qs[key] && JSON.parse(qs[key] as string)
      }),
      DEFAULT_FILTER_VALUES
    )
  }, [history.location.search])

  const itemsWhere = useMemo<ItemsWhere>(() => {
    const itemsWhere = { registry: tcrAddress } as ItemsWhere
    if (queryParams.absent) itemsWhere.status = FILTER_STATUS.absent
    if (queryParams.registered) itemsWhere.status = FILTER_STATUS.registered
    if (queryParams.submitted) itemsWhere.status = FILTER_STATUS.submitted
    if (queryParams.removalRequested)
      itemsWhere.status = FILTER_STATUS.removalRequested
    if (queryParams.challengedSubmissions) {
      itemsWhere.status = FILTER_STATUS.challengedSubmissions
      itemsWhere.disputed = true
    }
    if (queryParams.challengedRemovals) {
      itemsWhere.status = FILTER_STATUS.challengedRemovals
      itemsWhere.disputed = true
    }
    return itemsWhere
  }, [queryParams, tcrAddress])

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
        setError(toKError(err))
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
        skip: (queryParams.page - 1) * ITEMS_PER_PAGE,
        first: ITEMS_PER_PAGE,
        orderDirection: queryParams.oldestFirst
          ? ORDER_DIR.asc
          : ORDER_DIR.desc,
        where: {
          ...itemsWhere,
          registry: tcrAddress,
          itemID
        }
      }
    })
  }, [
    itemsWhere,
    tcrAddress,
    itemID,
    queryParams.oldestFirst,
    queryParams.page,
    execLightItemsQuery,
    execRegQuery
  ])

  const items = useMemo<LItem[]>(() => {
    if (loading || !metaEvidence) return []

    return itemsRawData.litems.map(
      ({
        itemID,
        status,
        requests,
        data,
        props
      }: {
        itemID: string
        status: string
        requests: Array<LRequest>
        data: string
        props: Array<LItemProp>
      }) => {
        const latestRequest = requests[0] // requests is ordered desc
        const { rounds } = latestRequest
        const latestRound = rounds[0] // rounds is ordered desc
        const { disputed, resolved, disputeID, submissionTime } = latestRequest
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
          columns: metaEvidence.metadata.columns.map(
            (col: MetadataColumn, i) => ({
              ...col,
              value: decodedData[i]
            })
          ),
          requests,
          latestRequest,
          latestRound,
          disputeStatus,
          disputed,
          resolved,
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
      }
    )
  }, [loading, metaEvidence, itemsRawData])

  return {
    loading,
    items,
    metaEvidence,
    tcrAddress,
    regData,
    error
  }
}

export default useLightTcrContext
