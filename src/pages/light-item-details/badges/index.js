import React, {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react'
import styled from 'styled-components'
import { Card, Typography, Divider, Button, Result, Icon } from 'antd'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { useLazyQuery } from '@apollo/client'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import _GTCRView from 'assets/abis/LightGeneralizedTCRView.json'
import { WalletContext } from 'contexts/wallet-context'
import ItemStatusBadge from 'components/item-status-badge'
import itemPropTypes from 'prop-types/item'
import AddBadgeModal from '../modals/add-badge'
import { CONTRACT_STATUS, DISPUTE_STATUS } from 'utils/item-status'
import SubmitModal from '../modals/submit'
import SubmitConnectModal from '../modals/submit-connect'
import useTcrView from 'hooks/tcr-view'
import takeLower from 'utils/lower-limit'
import { LIGHT_ITEMS_QUERY } from 'utils/graphql'
import { bigNumberify } from 'ethers/utils'
import useGetLogs from 'hooks/get-logs'
import { gtcrViewAddresses, subgraphUrl } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'

export const StyledGrid = styled.div`
  display: grid;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

export const StyledLogo = styled.img`
  object-fit: contain;
  max-width: 40%;
  padding-bottom: 12px;
`

export const StyledCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

export const StyledParagraph = styled(Typography.Paragraph)`
  text-align: center;
`

export const StyledDivider = styled(Divider)`
  margin: 24px 0 !important;
`

export const DashedCard = styled(Card)`
  box-shadow: none;
  background: none;
  border: dashed;
  border-width: 2px;
  border-color: #bc9cff;
`

export const DashedCardBody = styled.div`
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const mapToLegacy = items =>
  items
    .map(item => ({
      ...item,
      decodedData: item.metadata?.props.map(({ value }) => value),
      mergedData: item.metadata?.props
    }))
    .map(
      ({
        itemID,
        status: statusName,
        requests,
        data,
        decodedData,
        mergedData
      }) => {
        const { disputed, disputeID, submissionTime, rounds, resolved } =
          requests[0] ?? {}

        const {
          appealPeriodStart,
          appealPeriodEnd,
          ruling,
          hasPaidRequester,
          hasPaidChallenger,
          amountPaidRequester,
          amountPaidChallenger
        } = rounds[0] ?? {}

        const currentRuling =
          ruling === 'None' ? 0 : ruling === 'Accept' ? 1 : 2
        const disputeStatus = !disputed
          ? DISPUTE_STATUS.WAITING
          : resolved
          ? DISPUTE_STATUS.SOLVED
          : Number(appealPeriodEnd) > Date.now() / 1000
          ? DISPUTE_STATUS.APPEALABLE
          : DISPUTE_STATUS.WAITING

        const graphStatusNameToCode = {
          Absent: 0,
          Registered: 1,
          RegistrationRequested: 2,
          ClearingRequested: 3
        }

        return {
          ID: itemID,
          itemID,
          status: graphStatusNameToCode[statusName],
          disputeStatus,
          disputed,
          data,
          decodedData,
          mergedData,
          disputeID,
          submissionTime: bigNumberify(submissionTime),
          hasPaid: [false, hasPaidRequester, hasPaidChallenger],
          currentRuling,
          appealStart: bigNumberify(appealPeriodStart),
          appealEnd: bigNumberify(appealPeriodEnd),
          amountPaid: [
            bigNumberify(0),
            bigNumberify(amountPaidRequester),
            bigNumberify(amountPaidChallenger)
          ]
        }
      }
    )

const Badges = ({ connectedTCRAddr, item, tcrAddress }) => {
  const { timestamp, requestWeb3Auth } = useContext(WalletContext)
  const { library, active, networkId } = useWeb3Context()
  const { metadataByTime } = useTcrView(connectedTCRAddr)

  const [error, setError] = useState(false)
  const [addBadgeVisible, setAddBadgeVisible] = useState()
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [badgeToSubmit, setBadgeToSubmit] = useState()
  const [foundBadges, setFoundBadges] = useState([])
  const [connectedBadges, setConnectedBadges] = useState([])
  const [isFetchingBadges, setIsFetchingBadges] = useState()
  const [submitConnectVisible, setSubmitConnectVisible] = useState()
  const ARBITRABLE_TCR_VIEW_ADDRESS = gtcrViewAddresses[networkId]
  const GTCR_SUBGRAPH_URL = subgraphUrl[networkId]
  const [fetchItems, setFetchItems] = useState({
    fetchStarted: true,
    isFetching: false,
    data: null
  })
  const getLogs = useGetLogs(library)

  // Wire up the TCR.
  const gtcrView = useMemo(() => {
    if (!library || !active || !ARBITRABLE_TCR_VIEW_ADDRESS || !networkId)
      return
    try {
      return new ethers.Contract(
        ARBITRABLE_TCR_VIEW_ADDRESS,
        _GTCRView,
        library
      )
    } catch (err) {
      console.error('Error instantiating gtcr view contract', err)
      setError('Error instantiating view contract')
    }
  }, [ARBITRABLE_TCR_VIEW_ADDRESS, active, library, networkId])

  const [getBadges, badgesQuery] = useLazyQuery(LIGHT_ITEMS_QUERY)
  const badgesWhere = useMemo(
    () => ({ registry: connectedTCRAddr.toLowerCase(), status: 'Registered' }),
    [connectedTCRAddr]
  )

  useEffect(() => {
    if (!connectedTCRAddr) return
    getBadges({
      variables: {
        where: badgesWhere
      }
    })
  }, [badgesWhere, connectedTCRAddr, getBadges])

  // Fetch enabled badges.
  // TODO: Refactor this to use badge terminology and avoid
  // confusion with the item passed as props (i.e. fetchItems -> fetchBadges)
  useEffect(() => {
    if (!badgesQuery) return
    const { data, error, loading, called } = badgesQuery
    if (!called) return

    if (loading) {
      setFetchItems({ isFetching: true })
      setIsFetchingBadges(true)
    } else if (data) {
      let { litems: items } = data ?? {}
      items = mapToLegacy(items)
      setFetchItems({
        isFetching: false,
        fetchStarted: false,
        data: items,
        connectedTCRAddr
      })
    } else if (error) {
      console.error(`Error fetching badges`, error)
      setFetchItems({
        isFetching: false,
        fetchStarted: false,
        data: [],
        connectedTCRAddr
      })
    } else throw new Error('Error fetching badges (this should be unreachable)')
  }, [badgesQuery, connectedTCRAddr])

  // Decode items once meta data and items were fetched.
  const enabledBadges = useMemo(() => {
    if (!fetchItems.data || !metadataByTime) return

    const { data: encodedItems } = fetchItems

    return encodedItems.map((item, i) => {
      let decodedData
      const errors = []
      const { columns } = metadataByTime.byTimestamp[
        takeLower(Object.keys(metadataByTime.byTimestamp), item.timestamp)
      ].metadata
      try {
        decodedData = item.decodedData
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        errors.push(`Error decoding item ${item.ID} of TCR at ${tcrAddress}`)
      }

      // Return the item columns along with its TCR status data.
      return {
        tcrData: {
          ...item, // Spread to convert from array to object.
          decodedData
        },
        columns: columns.map(
          (col, i) => ({
            value: decodedData && decodedData[i],
            ...col
          }),
          { key: i }
        ),
        errors
      }
    })
  }, [fetchItems, metadataByTime, tcrAddress])

  // With the badge tcr addresses and the match file,
  // search for the current item.
  useEffect(() => {
    if (!enabledBadges || !gtcrView || !item) return
    if (!getLogs) return
    ;(async () => {
      const foundBadges = []
      const connectedBadges = []
      try {
        await Promise.all(
          enabledBadges.map(async ({ columns }) => {
            const badgeAddr = columns[0].value
            const matchFileURI = columns[1].value
            const badgeContract = new ethers.Contract(badgeAddr, _gtcr, library)
            // Get the badge contract metadata.
            const logs = (
              await getLogs({
                ...badgeContract.filters.MetaEvidence(),
                fromBlock: 0
              })
            ).map(log => badgeContract.interface.parseLog(log))
            if (logs.length === 0) {
              console.warn('Could not fetch metadata for contract', badgeAddr)
              return
            }
            const { _evidence: metaEvidencePath } = logs[logs.length - 1].values
            const [
              badgeMetaEvidenceResponse,
              matchFileResponse,
              badgeTcrData
            ] = await Promise.all([
              fetch(parseIpfs(metaEvidencePath)),
              fetch(parseIpfs(matchFileURI)),
              gtcrView.fetchArbitrable(badgeAddr)
            ])
            const badgeMetaEvidence = await badgeMetaEvidenceResponse.json()
            const matchFile = await matchFileResponse.json()
            const { columns: matchColumns } = matchFile
            const { metadata: badgeMetadata, fileURI } = badgeMetaEvidence
            const { submissionBaseDeposit, arbitrationCost } = badgeTcrData
            const submissionDeposit = submissionBaseDeposit.add(arbitrationCost)
            const { decodedData } = item
            connectedBadges.push({
              metadata: badgeMetadata,
              submissionDeposit,
              metaEvidence: badgeMetaEvidence,
              tcrAddress: badgeAddr,
              fileURI,
              matchFile,
              decodedData
            })

            // Search for the item on the badge TCR.
            const keywords = matchColumns.reduce((acc, curr) => {
              if (typeof curr !== 'number') return acc
              return `${acc} | ${item.decodedData[curr]}`
            }, badgeAddr.toLowerCase())
            const query = {
              query: `
                {
                  litems (where:{
                    registry: "${badgeAddr.toLowerCase()}"
                    keywords: "${keywords}"
                  }) {
                    itemID
                    status
                    data
                    metadata{
                      props {
                        value
                        type
                        label
                        description
                        isIdentifier
                      }
                    }
                    requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
                      disputed
                      disputeID
                      submissionTime
                      resolved
                      requester
                      challenger
                      resolutionTime
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
            }
            const { data } = await (
              await fetch(GTCR_SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query)
              })
            ).json()

            const result = mapToLegacy(data.litems)

            if (result.length > 0)
              foundBadges.push({
                tcrAddress: badgeAddr,
                item: { ...result[0] }, // Convert array to object.
                metadata: badgeMetadata,
                tcrData: badgeTcrData
              })
          })
        )
      } catch (err) {
        console.error(err)
        setError(err.message)
      } finally {
        setIsFetchingBadges(false)
        setFoundBadges(foundBadges || [])
        setConnectedBadges(connectedBadges || [])
      }
    })()
  }, [GTCR_SUBGRAPH_URL, enabledBadges, gtcrView, item, library, getLogs])

  // The available badges are the connected badges for which
  // there are no pending requests for this item.
  const availableBadges = useMemo(() => {
    if (!enabledBadges || !connectedBadges) return []
    return connectedBadges.filter(connectedBadge =>
      enabledBadges.filter(
        enabledBadge =>
          enabledBadge.columns[0].value !== connectedBadge ||
          enabledBadge.tcrData.status === CONTRACT_STATUS.ABSENT
      )
    )
  }, [connectedBadges, enabledBadges])

  const onSelectBadge = useCallback(selectedBadge => {
    setSubmissionFormOpen(true)
    setBadgeToSubmit(selectedBadge)
  }, [])

  if (error) return <Result status="warning" title={error} />

  return (
    <>
      <StyledDivider orientation="left">
        <span>
          {isFetchingBadges && (
            <Icon type="loading" style={{ marginRight: '12px' }} />
          )}
          Badges
        </span>
      </StyledDivider>
      <StyledGrid id="badges">
        {foundBadges.map(
          (
            {
              tcrAddress,
              item,
              metadata: { logoURI, tcrTitle, tcrDescription },
              tcrData: { challengePeriodDuration }
            },
            i
          ) => (
            <Card
              key={i}
              title={
                <ItemStatusBadge
                  item={item}
                  challengePeriodDuration={challengePeriodDuration}
                  timestamp={timestamp}
                  dark
                />
              }
            >
              <a href={`/tcr/${tcrAddress}/${item.ID}`}>
                <StyledCol>
                  <StyledLogo src={parseIpfs(logoURI)} />
                  <Typography.Title level={4}>{tcrTitle}</Typography.Title>
                  <StyledParagraph>{tcrDescription}</StyledParagraph>
                </StyledCol>
              </a>
            </Card>
          )
        )}
        <DashedCard>
          <DashedCardBody>
            <Button
              type="secondary"
              size="large"
              onClick={() => requestWeb3Auth(() => setAddBadgeVisible(true))}
            >
              Add Badge
            </Button>
          </DashedCardBody>
        </DashedCard>
      </StyledGrid>
      <AddBadgeModal
        visible={addBadgeVisible}
        onCancel={() => setAddBadgeVisible(false)}
        availableBadges={availableBadges}
        connectedTCRAddr={connectedTCRAddr}
        tcrAddress={tcrAddress}
        foundBadges={foundBadges}
        onSelectBadge={onSelectBadge}
        onEnableNewBadge={() => setSubmitConnectVisible(true)}
        isFetchingBadges={isFetchingBadges}
      />
      {badgeToSubmit && (
        <SubmitModal
          visible={submissionFormOpen}
          onCancel={() => setSubmissionFormOpen(false)}
          submissionDeposit={badgeToSubmit.submissionDeposit}
          challengePeriodDuration={badgeToSubmit.challengePeriodDuration}
          tcrAddress={badgeToSubmit.tcrAddress}
          metaEvidence={badgeToSubmit.metaEvidence}
          initialValues={badgeToSubmit.matchFile.columns.map(col =>
            col !== null ? badgeToSubmit.decodedData[col] : null
          )}
          disabledFields={badgeToSubmit.matchFile.columns.map(
            col => col !== null
          )}
        />
      )}
      <SubmitConnectModal
        visible={submitConnectVisible}
        onCancel={() => setSubmitConnectVisible(false)}
        initialValues={[tcrAddress]}
        tcrAddress={connectedTCRAddr}
        gtcrView={gtcrView}
      />
    </>
  )
}

Badges.propTypes = {
  connectedTCRAddr: PropTypes.string,
  item: itemPropTypes,
  tcrAddress: PropTypes.string
}

Badges.defaultProps = {
  item: null,
  connectedTCRAddr: null,
  tcrAddress: null
}

export default Badges
