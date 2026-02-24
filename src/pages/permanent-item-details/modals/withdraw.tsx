import React, { useState } from 'react'
import { Modal, Typography, Button, Alert } from 'components/ui'
import styled from 'styled-components'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import humanizeDuration from 'humanize-duration'
import EnsureAuth from 'components/ensure-auth'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'

export const StyledModal = styled(Modal)`
  & > .ui-modal-content {
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
  item: SubgraphItem
  registry: SubgraphRegistry
  itemName: string
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onCancel,
  item,
  registry,
  itemName,
}) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [loading, setLoading] = useState(false)

  const handleStartWithdraw = async () => {
    if (!item || !registry) return

    setLoading(true)

    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: registry.id,
        abi: _gtcr,
        functionName: 'startWithdrawItem',
        args: [item.itemID],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) onCancel()
    } catch (err) {
      console.error('Withdrawal failed:', err)
      errorToast(parseWagmiError(err))
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

      {registry?.withdrawingPeriod && (
        <StyledAlert
          message="Withdrawal Timing"
          description={`Withdrawing an item takes ${humanizeDuration(
            Number(registry.withdrawingPeriod) * 1000,
          )}. After starting the withdrawal, you must wait for this period to complete before the item is permanently removed from the registry.`}
          type="info"
          showIcon
        />
      )}

      <Typography.Paragraph>
        Are you sure you want to withdraw &quot;{itemName}&quot; from the
        registry? This will initiate the withdrawal period after which the item
        will be permanently removed.
      </Typography.Paragraph>

      <div style={{ textAlign: 'right', marginTop: 24 }}>
        <Button
          style={{ marginRight: 8 }}
          onClick={onCancel}
          disabled={loading}
        >
          Back
        </Button>
        <EnsureAuth>
          <Button
            type="primary"
            onClick={handleStartWithdraw}
            loading={loading}
          >
            Start Withdraw
          </Button>
        </EnsureAuth>
      </div>
    </StyledModal>
  )
}

export default WithdrawModal
