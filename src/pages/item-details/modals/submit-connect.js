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
  Result,
  Alert
} from 'antd'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { useDebounce } from 'use-debounce'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import ETHAmount from 'components/eth-amount'
import { addPeriod, isETHAddress } from 'utils/string'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import ipfsPublish from 'utils/ipfs-publish'
import { WalletContext } from 'contexts/wallet-context'
import { gtcrEncode } from '@kleros/gtcr-encoder'
import { TourContext } from 'contexts/tour-context.js'
import useNativeCurrency from 'hooks/native-currency.js'
import useGetLogs from 'hooks/get-logs'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const SkeletonTitleProps = { width: '90px' }

const SubmitConnectModal = props => {
  const nativeCurrency = useNativeCurrency()
  const { onCancel, initialValues, tcrAddress: relTCRAddress, gtcrView } = props
  const { pushWeb3Action } = useContext(WalletContext)
  const { library, active, networkId } = useWeb3Context()
  const { setUserSubscribed } = useContext(TourContext)
  const [error, setError] = useState()

  // This is the main TCR.
  // TODO: Find a way to fetch this information from somewhere without centralization. The user should not have to type this.
  const [tcrAddr, setTCRAddr] = useState()
  const [debouncedTCRAddr] = useDebounce(tcrAddr, 300)
  const [tcrMetaEvidence, setTCRMetaEvidence] = useState()

  const [badgeTCRAddr, setBadgeTCRAddr] = useState() // This is the TCR the user wants enable as a badge.
  const [debouncedBadgeTCRAddr] = useDebounce(badgeTCRAddr, 300)
  const [badgeTCRMetadata, setBadgeTCRMetadata] = useState()

  const [relTCRMetaEvidence, setRelTCRMetaEvidence] = useState()
  const [relTCRSubmissionDeposit, setRelTCRSubmissionDeposit] = useState()

  const [match, setMatch] = useState()
  const getLogs = useGetLogs(library)

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
    if (!getLogs) return
    ;(async () => {
      try {
        const tcr = new ethers.Contract(debouncedTCRAddr, _gtcr, library)
        const logs = (
          await getLogs({
            ...tcr.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => tcr.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        setTCRMetaEvidence(
          await (await fetch(parseIpfs(metaEvidencePath))).json()
        )
      } catch (err) {
        console.error('Error fetching TCR metadata', err)
        setError('Error fetching list metadata')
      }
    })()
  }, [active, debouncedTCRAddr, library, networkId, getLogs])

  // Fetch metadata of the badge TCR.
  useEffect(() => {
    if (!debouncedBadgeTCRAddr) return
    if (!isETHAddress(debouncedBadgeTCRAddr)) return
    if (!library || !active || !networkId) return
    if (!getLogs) return
    ;(async () => {
      try {
        const badgeTCR = new ethers.Contract(
          debouncedBadgeTCRAddr,
          _gtcr,
          library
        )
        const logs = (
          await getLogs({
            ...badgeTCR.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => badgeTCR.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const file = await (await fetch(parseIpfs(metaEvidencePath))).json()
        setBadgeTCRMetadata(file.metadata)
      } catch (err) {
        console.error('Error fetching TCR metadata', err)
        setError('Error fetching list metadata')
      }
    })()
  }, [active, debouncedBadgeTCRAddr, library, networkId, getLogs])

  // Fetch meta evidence and tcr data from connect tcr.
  useEffect(() => {
    if (!relTCRAddress || !gtcrView) return
    if (!getLogs) return
    ;(async () => {
      try {
        const relTCR = new ethers.Contract(relTCRAddress, _gtcr, library)
        const logs = (
          await getLogs({
            ...relTCR.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => relTCR.interface.parseLog(log))
        if (logs.length === 0) return

        const { _evidence: metaEvidencePath } = logs[0].values
        const [fileResponse, relTCRData] = await Promise.all([
          fetch(parseIpfs(metaEvidencePath)),
          gtcrView.fetchArbitrable(relTCRAddress)
        ])

        // Submission deposit = submitter base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const { submissionBaseDeposit, arbitrationCost } = relTCRData
        const submissionDeposit = submissionBaseDeposit.add(arbitrationCost)

        const file = await fileResponse.json()
        setRelTCRMetaEvidence(file)
        setRelTCRSubmissionDeposit(submissionDeposit)
      } catch (err) {
        console.error(err)
        setError(err.message)
      }
    })()
  }, [gtcrView, library, relTCRAddress, getLogs])

  const NONE = 'None'
  const handleChange = useCallback(
    (i, j) => {
      if (!badgeTCRMetadata || !tcrMetaEvidence) return
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
      tcrMetaEvidence
    ]
  )

  const handleSubmit = useCallback(async () => {
    if (!relTCRMetaEvidence) return
    const file = new TextEncoder().encode(JSON.stringify(match))
    /* eslint-disable-next-line prettier/prettier */
    const ipfsFileObj = await ipfsPublish('match-file.json', file)
    const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`
    const { columns, itemName } = relTCRMetaEvidence.metadata

    // To learn if an item is present on another TCR (i.e to learn
    // if it has that badge), we must match the columns of the two TCRs.
    // This information is stored in the match file, in the columns field.
    // It is an array of numbers, where each number indexes a column of items
    // the badge TCR, to the columns of the current TCR.
    // If a column is not used for matching, it just has the string 'null'.
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

      // Request signature and submit.
      const tx = await gtcr.addItem(encodedParams, {
        value: relTCRSubmissionDeposit
      })
      onCancel() // Hide the submission modal.

      // Subscribe for notifications
      if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!networkId) {
        const itemID = ethers.utils.solidityKeccak256(
          ['bytes'],
          [encodedParams]
        )
        fetch(
          `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
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
          .then(() => setUserSubscribed(true))
          .catch(err => {
            console.error('Failed to subscribe for notifications.', err)
          })
      }
      return {
        tx,
        actionMessage: `Submitting ${(itemName && itemName.toLowerCase()) ||
          'item'}`
      }
    })
  }, [
    badgeTCRAddr,
    match,
    onCancel,
    pushWeb3Action,
    relTCRAddress,
    relTCRMetaEvidence,
    relTCRSubmissionDeposit,
    setUserSubscribed
  ])

  const submitDisabled = useMemo(
    () => !match || match.columns.filter(col => col !== null).length === 0,
    [match]
  )

  if (!relTCRMetaEvidence || !relTCRSubmissionDeposit)
    return (
      <StyledModal
        title="Enable Badge"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>
        ]}
        {...props}
      >
        <StyledSpin />
      </StyledModal>
    )

  const { fileURI } = relTCRMetaEvidence
  if (error)
    return (
      <StyledModal
        title="Enable Badge"
        footer={[
          <Button key="back" onClick={onCancel}>
            Back
          </Button>
        ]}
        {...props}
      >
        <Result status="warning" title={error} />
      </StyledModal>
    )

  return (
    <StyledModal
      title="Enable Badge"
      footer={[
        <Button key="back" onClick={onCancel}>
          Back
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
        Read the&nbsp;
        <a
          href={parseIpfs(fileURI || '')}
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
            Parent list Address&nbsp;
            <Tooltip title="Fill with the address of the parent list.">
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
            Badge list address&nbsp;
            <Tooltip title="Fill here the address of the badge list.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </span>
        }
      >
        <Input
          placeholder="0xbeafb047beef..."
          onChange={e => setBadgeTCRAddr(e.target.value)}
          disabled={!tcrMetaEvidence}
        />
      </Form.Item>
      <StyledAlert
        message="Understand Badges"
        description="An item has a badge if it is also present on the badge list. As an example, a token submission 'PNK' on a list of Tokens can display the ERC20 Badge if the same submission is also present on the ERC20 Badge list. To check if an item is present on two lists we must match common fields. In the example we would choose field 'Address'. The comparison is strict, in other words, if multiple fields are matched, ALL values must match perfectly. In general, you should use the least amount of columns that are enough to uniquely identify a submission on both lists to avoid items not being detected due to (for example, case differences)."
        type="info"
        showIcon
      />
      <Typography.Paragraph>
        Match at least one ID column of the parent list to use to when searching
        for the item in the badge list. The more fields matched, the stricter
        the search.
      </Typography.Paragraph>
      {badgeTCRMetadata &&
        badgeTCRMetadata.columns.map((column, i) => (
          <Row key={i} gutter={[8, 8]}>
            <Col span={12}>
              <span>
                {column.label}
                {column.description && (
                  <Tooltip title={addPeriod(column.description)}>
                    &nbsp;
                    <Icon type="question-circle-o" />
                  </Tooltip>
                )}
              </span>
            </Col>
            <Col span={12}>
              {tcrMetaEvidence.metadata ? (
                <Select
                  defaultValue={NONE}
                  style={{ width: '100%' }}
                  onChange={(_, { key }) => handleChange(i, key)}
                >
                  {[{ label: NONE }, ...tcrMetaEvidence.metadata.columns].map(
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
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
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
