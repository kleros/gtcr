import React, { useContext, useState, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { Modal, Typography, Button, Spin, Tooltip, Icon } from 'antd'
import PropTypes from 'prop-types'
import { ethers } from 'ethers'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { STATUS_CODE } from 'utils/permanent-item-status'
import ETHAmount from 'components/eth-amount'
import { WalletContext } from 'contexts/wallet-context'
import itemPropTypes from 'prop-types/item'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish.js'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { TourContext } from 'contexts/tour-context'
import { parseIpfs } from 'utils/ipfs-parse'
import { BigNumber } from 'ethers/utils'
import { useWeb3Context } from 'web3-react'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import { DepositContainer, DepositRow, DepositLabel } from './submit'

export const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

export const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)'
]

const ChallengeModal = ({
  item,
  itemName,
  onCancel,
  arbitrationCost,
  ...rest
}) => {
  const registry = item.registry
  const fileURI = registry.arbitrationSettings[0].metadata.policyURI
  const { pushWeb3Action, cancelRequest } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const { account, library } = useWeb3Context()
  const nativeCurrency = useNativeCurrency()

  const [balance, setBalance] = useState(ethers.constants.Zero)
  const [allowance, setAllowance] = useState(ethers.constants.Zero)
  const [nativeBalance, setNativeBalance] = useState()
  const [checkingToken, setCheckingToken] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isChallenging, setIsChallenging] = useState(false)
  const { symbol: tokenSymbol } = useTokenSymbol(registry.token)

  // the challengeStake is used to notify user of how much they'll pass
  // also used with the allowance/balance
  const challengeStake = new BigNumber(item.stake)
    .mul(registry.challengeStakeMultiplier)
    .div(10_000)

  const checkTokenStatus = useCallback(async () => {
    if (!account || !library || !registry.token) return

    setCheckingToken(true)
    try {
      const token = new ethers.Contract(registry.token, ERC20_ABI, library)
      const [bal, allow, nativeBal] = await Promise.all([
        token.balanceOf(account),
        token.allowance(account, registry.id),
        library.getBalance(account)
      ])
      setBalance(bal)
      setAllowance(allow)
      setNativeBalance(nativeBal)
    } catch (err) {
      console.error('Error checking token status:', err)
    }
    setCheckingToken(false)
  }, [account, library, registry.token, registry.id])

  useEffect(() => {
    checkTokenStatus()
  }, [checkTokenStatus])

  // Reset loading states when modal is closed
  useEffect(
    () => () => {
      setIsApproving(false)
      setIsChallenging(false)
    },
    []
  )

  const handleApprove = useCallback(() => {
    setIsApproving(true)
    pushWeb3Action(async ({ _account, _networkId }, signer) => {
      try {
        const token = new ethers.Contract(registry.token, ERC20_ABI, signer)
        const tx = await token.approve(registry.id, challengeStake.toString())

        return {
          tx,
          actionMessage: `Approving ${tokenSymbol}`,
          onTxMined: async () => {
            // Immediately check allowance
            await checkTokenStatus()

            // If allowance is still not enough, wait 5s and check again
            setTimeout(async () => {
              await checkTokenStatus()
            }, 5000)

            setIsApproving(false)
          }
        }
      } catch (err) {
        setIsApproving(false)
        throw err
      }
    })
  }, [
    pushWeb3Action,
    registry.token,
    registry.id,
    challengeStake,
    checkTokenStatus,
    tokenSymbol
  ])

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment
  }) => {
    setIsChallenging(true)
    pushWeb3Action(async ({ account, networkId }, signer) => {
      try {
        const gtcr = new ethers.Contract(registry.id, _gtcr, signer)
        const evidenceJSON = {
          title: title || 'Challenge Justification',
          description,
          ...evidenceAttachment
        }

        const enc = new TextEncoder()
        const fileData = enc.encode(JSON.stringify(evidenceJSON))
        /* eslint-enable prettier/prettier */
        const ipfsEvidencePath = getIPFSPath(
          await ipfsPublish('evidence.json', fileData)
        )

        // Request signature and submit.
        const tx = await gtcr.challengeItem(item.itemID, ipfsEvidencePath, {
          value: arbitrationCost
        })

        onCancel() // Hide the submission modal.

        // Subscribe for notifications
        if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!networkId)
          fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
            {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriberAddr: ethers.utils.getAddress(account),
                tcrAddr: ethers.utils.getAddress(registry.id),
                itemID: item.itemID,
                networkID: networkId
              })
            }
          )
            .then(() => setUserSubscribed(true))
            .catch(err => {
              console.error('Failed to subscribe for notifications.', err)
            })
        return {
          tx,
          actionMessage: `Challenging ${(itemName && itemName.toLowerCase()) ||
            'item'}`,
          onTxMined: () => {
            setIsChallenging(false)
          }
        }
      } catch (err) {
        setIsChallenging(false)
        throw err
      }
    })
  }

  const hasEnoughBalance = balance.gte(challengeStake.toString())
  const hasEnoughAllowance = allowance.gte(challengeStake.toString())
  const hasEnoughNativeBalance =
    nativeBalance && nativeBalance.gte(arbitrationCost || 0)

  const renderChallengeButton = () => {
    if (checkingToken)
      return (
        <Button key="checking" loading>
          Checking Token...
        </Button>
      )

    if (!hasEnoughBalance)
      return (
        <Button key="insufficient" disabled>
          Insufficient {tokenSymbol} Balance
        </Button>
      )

    if (!hasEnoughNativeBalance)
      return (
        <Button key="insufficientNative" disabled>
          Not enough {nativeCurrency}
        </Button>
      )

    if (!hasEnoughAllowance)
      return (
        <Button
          key="approve"
          type="primary"
          onClick={handleApprove}
          loading={isApproving}
        >
          Approve {tokenSymbol}
        </Button>
      )

    return (
      <Button
        key="challengeSubmit"
        type="primary"
        form={EVIDENCE_FORM_ID}
        htmlType="submit"
        loading={isChallenging}
      >
        Challenge
      </Button>
    )
  }

  const EVIDENCE_FORM_ID = 'challengeEvidenceForm'
  if (!arbitrationCost)
    return (
      <StyledModal title="Submit Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      title="Challenge Item"
      onCancel={() => {
        setIsApproving(false)
        setIsChallenging(false)
        cancelRequest()
        onCancel()
      }}
      footer={[
        <Button
          key="back"
          onClick={() => {
            setIsApproving(false)
            setIsChallenging(false)
            cancelRequest()
            onCancel()
          }}
        >
          Back
        </Button>,
        renderChallengeButton()
      ]}
      {...rest}
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
      <Typography.Paragraph>
        Explain to jurors why do you think this item should be removed:
      </Typography.Paragraph>
      <EvidenceForm onSubmit={challengeRequest} formID={EVIDENCE_FORM_ID} />
      <Typography.Paragraph>
        To challenge this item, deposits are required. These values will be
        awarded to the party that wins the dispute.
      </Typography.Paragraph>
      <DepositContainer>
        <DepositRow>
          <DepositLabel>
            Challenge Stake Deposit
            <Tooltip title="The challenge stake deposit paid in tokens required to challenge this item.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </DepositLabel>
          <ETHAmount
            decimals={3}
            amount={challengeStake.toString()}
            displayUnit={` ${tokenSymbol}`}
          />
        </DepositRow>
        <DepositRow>
          <DepositLabel>
            Arbitration Cost
            <Tooltip title="The arbitration cost paid in native currency to cover potential disputes.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </DepositLabel>
          <ETHAmount
            decimals={3}
            amount={arbitrationCost.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </DepositRow>
      </DepositContainer>
      <DepositRow style={{ marginTop: 8 }}>
        <DepositLabel>Total deposit</DepositLabel>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <ETHAmount
            decimals={3}
            amount={challengeStake.toString()}
            displayUnit={` ${tokenSymbol}`}
          />
          <span style={{ margin: '0 6px' }}>+</span>
          <ETHAmount
            decimals={3}
            amount={arbitrationCost.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </span>
      </DepositRow>
    </StyledModal>
  )
}

ChallengeModal.propTypes = {
  item: itemPropTypes,
  itemName: PropTypes.string,
  fileURI: PropTypes.string,
  statusCode: PropTypes.oneOf(Object.values(STATUS_CODE))
}

ChallengeModal.defaultProps = {
  item: null,
  itemName: 'item',
  fileURI: '',
  statusCode: STATUS_CODE.REJECTED
}

export default ChallengeModal
