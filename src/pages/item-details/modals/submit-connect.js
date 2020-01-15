import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo
} from 'react'
import {
  Spin,
  Modal,
  Button,
  Typography,
  Descriptions,
  Input,
  Col,
  Row,
  Form,
  Tooltip,
  Icon,
  Select,
  Skeleton,
  Result
} from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import { useDebounce } from 'use-debounce'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import ETHAmount from '../../../components/eth-amount.js'
import { isETHAddress } from '../../../utils/string'
import Archon from '@kleros/archon'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import ipfsPublish from '../../../utils/ipfs-publish'
import { WalletContext } from '../../../bootstrap/wallet-context'
import { gtcrEncode } from '../../../utils/encoder'

const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

const SkeletonTitleProps = { width: '90px' }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const SubmitConnectModal = props => {
  const { onCancel, initialValues, tcrAddress: relTCRAddress, gtcrView } = props
  const { pushWeb3Action } = useContext(WalletContext)
  const { library, active, networkId } = useWeb3Context()
  const [error, setError] = useState()
  const [tcrAddr, setTCRAddr] = useState() // This is the main TCR. TODO: Fetch this information from somewhere. The user should not have to type this.
  const [debouncedTCRAddr] = useDebounce(tcrAddr, 300)
  const [tcrMetadata, setTCRMetadata] = useState()

  const [badgeTCRAddr, setBadgeTCRAddr] = useState() // This is the TCR the user wants enable as a badge.
  const [debouncedBadgeTCRAddr] = useDebounce(badgeTCRAddr, 300)
  const [badgeTCRMetadata, setBadgeTCRMetadata] = useState()

  const [relTCRMetaEvidence, setRelTCRMetaEvidence] = useState()
  const [relTCRSubmissionDeposit, setRelTCRSubmissionDeposit] = useState()

  const [match, setMatch] = useState()

  // Set initial values, if any.
  useEffect(() => {
    if (!initialValues) return
    setTCRAddr(initialValues[0])
  }, [initialValues])

  // Fetch metadata of the parent TCR.
  useEffect(() => {
    if (!debouncedTCRAddr) return
    if (!isETHAddress(debouncedTCRAddr)) return
    if (!library || !active || !networkId) return
    ;(async () => {
      try {
        const tcr = new ethers.Contract(debouncedTCRAddr, _gtcr, library)
        const logs = (
          await library.getLogs({
            ...tcr.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => tcr.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()
        setTCRMetadata(file.metadata)
      } catch (err) {
        console.error('Error fetching tcr metadata', err)
        setError('Error fetching tcr metadata')
      }
    })()
  }, [active, debouncedTCRAddr, library, networkId])

  // Fetch metadata of the badge TCR.
  useEffect(() => {
    if (!debouncedBadgeTCRAddr) return
    if (!isETHAddress(debouncedBadgeTCRAddr)) return
    if (!library || !active || !networkId) return
    ;(async () => {
      try {
        const badgeTCR = new ethers.Contract(
          debouncedBadgeTCRAddr,
          _gtcr,
          library
        )
        const logs = (
          await library.getLogs({
            ...badgeTCR.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => badgeTCR.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()
        setBadgeTCRMetadata(file.metadata)
      } catch (err) {
        console.error('Error fetching tcr metadata', err)
        setError('Error fetching tcr metadata')
      }
    })()
  }, [active, debouncedBadgeTCRAddr, library, networkId])

  // Fetch meta evidence and tcr data from connect tcr.
  useEffect(() => {
    if (!relTCRAddress || !gtcrView) return
    ;(async () => {
      try {
        const relTCR = new ethers.Contract(relTCRAddress, _gtcr, library)
        const logs = (
          await library.getLogs({
            ...relTCR.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => relTCR.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const [fileResponse, relTCRData] = await Promise.all([
          fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath),
          gtcrView.fetchArbitrable(relTCRAddress)
        ])

        // Submission deposit = submitter base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const {
          submissionBaseDeposit,
          arbitrationCost,
          sharedStakeMultiplier,
          MULTIPLIER_DIVISOR
        } = relTCRData
        const submissionDeposit = submissionBaseDeposit
          .add(arbitrationCost)
          .add(
            arbitrationCost.mul(sharedStakeMultiplier).div(MULTIPLIER_DIVISOR)
          )

        const file = await fileResponse.json()
        setRelTCRMetaEvidence(file)
        setRelTCRSubmissionDeposit(submissionDeposit)
      } catch (err) {
        console.error(err)
        setError(err)
      }
    })()
  }, [gtcrView, library, relTCRAddress])

  const NONE = 'None'
  const handleChange = useCallback(
    (i, j) => {
      if (!badgeTCRMetadata || !tcrMetadata) return
      let newState
      if (!match)
        newState = {
          parentTCR: debouncedTCRAddr,
          connectedTCR: relTCRAddress,
          badgeTCR: debouncedBadgeTCRAddr,
          columns: badgeTCRMetadata.columns.map(() => null)
        }
      else newState = { ...match }

      if (Number(j) === 0)
        // User did not select a column (i.e. selected None).
        newState.columns[i] = null
      else newState.columns[i] = j - 1
      setMatch(newState)
    },
    [
      badgeTCRMetadata,
      debouncedBadgeTCRAddr,
      debouncedTCRAddr,
      match,
      relTCRAddress,
      tcrMetadata
    ]
  )

  const handleSubmit = useCallback(async () => {
    if (!relTCRMetaEvidence) return
    const file = new TextEncoder().encode(JSON.stringify(match))
    /* eslint-disable-next-line prettier/prettier */
    const multihash = Archon.utils.multihashFile(file, 0x1B)
    const ipfsFileObj = await ipfsPublish(multihash, file)
    const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`
    const { columns, itemName } = relTCRMetaEvidence.metadata
    const values = {
      Address: badgeTCRAddr,
      'Match File URI': fileURI
    }

    pushWeb3Action(async ({ account, networkId }, signer) => {
      const gtcr = new ethers.Contract(relTCRAddress, _gtcr, signer)
      const encodedParams = gtcrEncode({
        columns,
        values
      })
      console.info(columns, values)

      // Request signature and submit.
      const tx = await gtcr.addItem(encodedParams, {
        value: relTCRSubmissionDeposit
      })
      onCancel() // Hide the submission modal.
      return {
        tx,
        actionMessage: `Submitting ${(itemName && itemName.toLowerCase()) ||
          'item'}`,
        onTxMined: () => {
          // Subscribe for notifications
          if (!process.env.REACT_APP_NOTIFICATIONS_API_URL) return
          const itemID = ethers.utils.solidityKeccak256(
            ['bytes'],
            [encodedParams]
          )
          fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/api/subscribe`,
            {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriberAddr: ethers.utils.getAddress(account),
                tcrAddr: ethers.utils.getAddress(relTCRAddress),
                itemID,
                networkID: networkId
              })
            }
          )
        }
      }
    })
  }, [
    badgeTCRAddr,
    match,
    onCancel,
    pushWeb3Action,
    relTCRAddress,
    relTCRMetaEvidence,
    relTCRSubmissionDeposit
  ])

  const submitDisabled = useMemo(
    () => !match || match.columns.filter(col => col !== null).length === 0,
    [match]
  )

  if (!relTCRMetaEvidence || !relTCRSubmissionDeposit)
    return (
      <Modal
        title="Enable Badge"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>
        ]}
        {...props}
      >
        <StyledSpin />
      </Modal>
    )

  const { fileURI } = relTCRMetaEvidence.metadata
  if (error)
    return (
      <Modal
        title="Enable Badge"
        footer={[
          <Button key="back" onClick={onCancel}>
            Return
          </Button>
        ]}
        {...props}
      >
        <Result status="warning" title={error} />
      </Modal>
    )

  return (
    <Modal
      title="Enable Badge"
      footer={[
        <Button key="back" onClick={onCancel}>
          Return
        </Button>,
        <Button
          key="submit"
          type="primary"
          htmlType="submit"
          onClick={handleSubmit}
          disabled={submitDisabled}
        >
          Submit
        </Button>
      ]}
      {...props}
    >
      <Typography.Title level={4}>
        See the&nbsp;
        <a
          href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Listing Criteria
        </a>
        .
      </Typography.Title>
      <Form.Item
        label={
          <span>
            Parent TCR Address&nbsp;
            <Tooltip title="Fill with the address of the parent TCR.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </span>
        }
        style={{ marginBottom: '12px' }}
      >
        {initialValues ? (
          <Input value={initialValues[0]} disabled />
        ) : (
          <Input
            placeholder="0x1337deadbeef..."
            onChange={e => setTCRAddr(e.target.value)}
          />
        )}
      </Form.Item>
      <Form.Item
        label={
          <span>
            Badge TCR Address&nbsp;
            <Tooltip title="Fill here the address of the badge TCR.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </span>
        }
      >
        <Input
          placeholder="0xbeafb047beef..."
          onChange={e => setBadgeTCRAddr(e.target.value)}
        />
      </Form.Item>
      <Typography.Paragraph>
        Select at least one column of the parent TCR to use to when searching
        for the item in the badge TCR.
      </Typography.Paragraph>
      {badgeTCRMetadata &&
        badgeTCRMetadata.columns.map((column, i) => (
          <Row key={i} gutter={[8, 8]}>
            <Col span={12}>
              <span>
                {column.label}
                {column.description && (
                  <Tooltip title={column.description}>
                    &nbsp;
                    <Icon type="question-circle-o" />
                  </Tooltip>
                )}
              </span>
            </Col>
            <Col span={12}>
              {tcrMetadata ? (
                <Select
                  defaultValue={NONE}
                  style={{ width: '100%' }}
                  onChange={(_, { key }) => handleChange(i, key)}
                >
                  {[{ label: NONE }, ...tcrMetadata.columns].map(
                    (column, j) => (
                      <Select.Option value={column.label} key={j}>
                        {column.label}
                      </Select.Option>
                    )
                  )}
                </Select>
              ) : (
                <StyledSkeleton
                  active
                  paragraph={false}
                  title={SkeletonTitleProps}
                />
              )}
            </Col>
          </Row>
        ))}
      <Typography.Paragraph>
        A deposit is required to submit. This value reimbursed at the end of the
        challenge period or, if there is a dispute, be awarded to the party that
        wins.
      </Typography.Paragraph>
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount
            decimals={3}
            amount={relTCRSubmissionDeposit.toString()}
            displayUnit
          />
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  )
}

SubmitConnectModal.propTypes = {
  onCancel: PropTypes.func.isRequired,
  initialValues: PropTypes.arrayOf(PropTypes.any),
  tcrAddress: PropTypes.string,
  gtcrView: PropTypes.shape({
    fetchArbitrable: PropTypes.func
  }).isRequired
}

SubmitConnectModal.defaultProps = {
  initialValues: null,
  tcrAddress: null
}

export default SubmitConnectModal
