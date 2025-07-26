import React, { useContext, useState } from 'react'
import { Modal, Typography, Button, Alert } from 'antd'
import styled from 'styled-components'
import { ethers } from 'ethers'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { WalletContext } from 'contexts/wallet-context'
import { useWeb3Context } from 'web3-react'

export const StyledModal: any = styled(Modal)`
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

export const StyledAlert = styled(Alert)`
  margin-bottom: 16px;
  text-transform: initial;
`

interface WithdrawModalProps {
  isOpen: boolean
  onCancel: () => void
  item: any
  registry: any
  itemName: string
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onCancel,
  item,
  registry,
  itemName
}) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const { account } = useWeb3Context()
  const [loading, setLoading] = useState(false)

  const handleStartWithdraw = async () => {
    if (!item || !registry) return

    setLoading(true)

    const executeWithdraw = async (_: any, signer: any) => {
      const gtcr = new ethers.Contract(registry.id, _gtcr, signer)
      return {
        tx: await gtcr.startWithdrawItem(item.itemID),
        actionMessage: 'Starting withdrawal'
      }
    }

    try {
      await pushWeb3Action(executeWithdraw)
      onCancel() // Close modal on success
    } catch (error) {
      console.error('Withdrawal failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <StyledModal
      title="Withdraw Item"
      visible={isOpen}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <StyledAlert
        message="Warning"
        description="Once you start the withdrawal process, this item will be removed from the registry after the withdrawal period. This action cannot be undone."
        type="warning"
        showIcon
      />

      <Typography.Paragraph>
        Are you sure you want to withdraw "{itemName}" from the registry? This
        will initiate the withdrawal period after which the item will be
        permanently removed.
      </Typography.Paragraph>

      <div style={{ textAlign: 'right', marginTop: 24 }}>
        <Button
          style={{ marginRight: 8 }}
          onClick={onCancel}
          disabled={loading}
        >
          Back
        </Button>
        <Button type="primary" onClick={handleStartWithdraw} loading={loading}>
          Start Withdraw
        </Button>
      </div>
    </StyledModal>
  )
}

export default WithdrawModal
