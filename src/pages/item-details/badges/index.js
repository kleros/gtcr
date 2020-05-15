import React, {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react'
import { Card, Typography, Divider, Button, Result, Icon } from 'antd'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { WalletContext } from '../../../bootstrap/wallet-context'
import ItemStatusBadge from '../../../components/item-status-badge'
import useNetworkEnvVariable from '../../../hooks/network-env'
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../../../utils/string'
import itemPropTypes from '../../../prop-types/item'
import { gtcrDecode, gtcrEncode } from '../../../utils/encoder'
import AddBadgeModal from '../modals/add-badge'
import { CONTRACT_STATUS } from '../../../utils/item-status'
import SubmitModal from '../modals/submit'
import SubmitConnectModal from '../modals/submit-connect'

const StyledGrid = styled.div`
  display: grid;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

const StyledLogo = styled.img`
  object-fit: contain;
  max-width: 40%;
  padding-bottom: 12px;
`

const StyledCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const StyledParagraph = styled(Typography.Paragraph)`
  text-align: center;
`

const StyledDivider = styled(Divider)`
  margin: 24px 0 !important;
`

const DashedCard = styled(Card)`
  box-shadow: none;
  background: none;
  border: dashed;
  border-width: 2px;
  border-color: #bc9cff;
`

const DashedCardBody = styled.div`
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const Badges = ({ connectedTCRAddr, item, tcrAddress }) => {
  const { timestamp, requestWeb3Auth } = useContext(WalletContext)
  const { library, active, networkId } = useWeb3Context()
  const [error, setError] = useState(false)
  const [addBadgeVisible, setAddBadgeVisible] = useState()
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [badgeToSubmit, setBadgeToSubmit] = useState()
  const [tcrMetadata, setTCRMetadata] = useState()
  const [foundBadges, setFoundBadges] = useState([])
  const [connectedBadges, setConnectedBadges] = useState([])
  const [isFetchingBadges, setIsFetchingBadges] = useState()
  const [submitConnectVisible, setSubmitConnectVisible] = useState()
  const ARBITRABLE_TCR_VIEW_ADDRESS = useNetworkEnvVariable(
    'REACT_APP_GTCRVIEW_ADDRESSES',
    networkId
  )
  const [fetchItems, setFetchItems] = useState({
    fetchStarted: true,
    isFetching: false,
    data: null
  })

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

  const gtcr = useMemo(() => {
    if (!library || !active || !connectedTCRAddr || !networkId) return
    try {
      return new ethers.Contract(connectedTCRAddr, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError('Error setting up this TCR')
    }
  }, [active, connectedTCRAddr, library, networkId])

  // Fetch enabled badges.
  useEffect(() => {
    if (
      !gtcr ||
      !gtcrView ||
      !connectedTCRAddr ||
      connectedTCRAddr === ZERO_ADDRESS ||
      fetchItems.isFetching ||
      !fetchItems.fetchStarted
    )
      return

    setFetchItems({ isFetching: true })
    setIsFetchingBadges(true)
    // Filter fields
    //  - Include absent items in result;
    //  - Include registered items in result;
    //  - Include items with registration requests that are not disputed in result;
    //  - Include items with clearing requests that are not disputed in result;
    //  - Include disputed items with registration requests in result;
    //  - Include disputed items with clearing requests in result;
    //  - Include items with a request by _party;
    //  - Include items challenged by _party.
    const filter = [false, true, false, true, false, false, false, false]
    const oldestFirst = false
    let encodedItems
    const itemsPerRequest = 100
    ;(async () => {
      try {
        encodedItems = await gtcrView.queryItems(
          connectedTCRAddr,
          0,
          itemsPerRequest,
          filter,
          oldestFirst,
          ZERO_ADDRESS
        )

        // Filter out empty slots from the results.
        encodedItems = encodedItems[0].filter(item => item.ID !== ZERO_BYTES32)
      } catch (err) {
        console.error('Error fetching items', err)
        setError('Error fetching items')
        setFetchItems({ isFetching: false, fetchStarted: false })
      } finally {
        setFetchItems({
          isFetching: false,
          fetchStarted: false,
          data: encodedItems,
          connectedTCRAddr
        })
      }
    })()
  }, [gtcrView, connectedTCRAddr, fetchItems, gtcr])

  // Fetch metadata of the connect TCR.
  useEffect(() => {
    if (!connectedTCRAddr) return
    if (!library || !active || !networkId) return
    ;(async () => {
      try {
        const tcr = new ethers.Contract(connectedTCRAddr, _gtcr, library)
        const logs = (
          await library.getLogs({
            ...tcr.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => tcr.interface.parseLog(log))
        if (logs.length === 0) {
          console.warn(
            'Could not fetch metadata connected TCR',
            connectedTCRAddr
          )
          return
        }

        const { _evidence: metaEvidencePath } = logs[logs.length - 1].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()
        setTCRMetadata(file.metadata)
      } catch (err) {
        console.error('Error fetching tcr metadata', err)
        setError('Error fetching tcr metadata')
      }
    })()
  }, [active, connectedTCRAddr, library, networkId])

  // Decode items once meta data and items were fetched.
  const enabledBadges = useMemo(() => {
    if (!fetchItems.data || !tcrMetadata) return

    const { data: encodedItems } = fetchItems
    const { columns } = tcrMetadata

    return encodedItems.map((item, i) => {
      let decodedItem
      const errors = []
      try {
        decodedItem = gtcrDecode({ values: item.data, columns })
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.warn(
          `Error decoding item ${item.ID} of TCR at ${tcrAddress} in badges view`
        )
        errors.push(`Error decoding item ${item.ID} of TCR at ${tcrAddress}`)
      }

      // Return the item columns along with its TCR status data.
      return {
        tcrData: {
          ...item // Spread to convert from array to object.
        },
        columns: columns.map(
          (col, i) => ({
            value: decodedItem && decodedItem[i],
            ...col
          }),
          { key: i }
        ),
        errors
      }
    })
  }, [fetchItems, tcrAddress, tcrMetadata])

  // With the badge tcr addresses and the match file,
  // search for the current item.
  useEffect(() => {
    if (!enabledBadges || !gtcrView || !item) return
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
              await library.getLogs({
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
              fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath),
              fetch(`${process.env.REACT_APP_IPFS_GATEWAY}${matchFileURI}`),
              gtcrView.fetchArbitrable(badgeAddr)
            ])
            const itemCount = (await badgeContract.itemCount()).toNumber()
            const badgeMetaEvidence = await badgeMetaEvidenceResponse.json()
            const matchFile = await matchFileResponse.json()
            const { columns: matchColumns } = matchFile
            const { metadata: badgeMetadata, fileURI } = badgeMetaEvidence
            // Submission deposit = submitter base deposit + arbitration cost + fee stake
            // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
            const {
              submissionBaseDeposit,
              arbitrationCost,
              sharedStakeMultiplier,
              MULTIPLIER_DIVISOR
            } = badgeTcrData
            const submissionDeposit = submissionBaseDeposit
              .add(arbitrationCost)
              .add(
                arbitrationCost
                  .mul(sharedStakeMultiplier)
                  .div(MULTIPLIER_DIVISOR)
              )

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
            const encodedMatch = gtcrEncode({
              columns: badgeMetadata.columns,
              values: badgeMetadata.columns
                .map(col => col.label)
                .reduce(
                  (acc, curr, i) => ({
                    ...acc,
                    [curr]:
                      matchColumns[i] !== null
                        ? decodedData[matchColumns[i]]
                        : undefined
                  }),
                  {}
                )
            })

            const itemsPerRequest = 100
            for (let i = 0; i < Math.ceil(itemCount / itemsPerRequest); i++) {
              const cursor =
                i > 0 && i < itemCount - 1 ? i * itemsPerRequest + 1 : 0
              const ignoreColumns = matchColumns.map(
                col => typeof col !== 'number'
              )
              const result = (
                await gtcrView.findItem(
                  badgeAddr,
                  encodedMatch,
                  cursor,
                  itemsPerRequest > itemCount ? 0 : itemsPerRequest,
                  [true, false, false, false], // Whether to skip items in the [absent, registered, submitted, removalRequested] states.
                  ignoreColumns
                )
              ).filter(res => res.ID !== ZERO_BYTES32)
              if (result.length > 0) {
                foundBadges.push({
                  tcrAddress: badgeAddr,
                  item: { ...result[0] }, // Convert array to object.
                  metadata: badgeMetadata,
                  tcrData: badgeTcrData
                })
                break
              }
            }
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
  }, [enabledBadges, gtcr, gtcrView, item, library, tcrMetadata])

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
      <StyledGrid>
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
              <a
                href={`/tcr/${tcrAddress}/${item.ID}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <StyledCol>
                  <StyledLogo
                    src={`${process.env.REACT_APP_IPFS_GATEWAY}${logoURI}`}
                  />
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
