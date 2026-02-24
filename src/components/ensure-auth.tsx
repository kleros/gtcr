import React from 'react'
import { Button } from 'components/ui'
import { useAccount } from 'wagmi'
import { appKitModal } from 'config/wagmi'

/**
 * Wraps an action button and shows a "Connect" button instead
 * if the user's wallet is not connected.
 * Follows the EnsureChain pattern from kleros/scout.
 */
interface EnsureAuthProps {
  children: React.ReactNode
}

const EnsureAuth = ({ children }: EnsureAuthProps) => {
  const { isConnected } = useAccount()

  if (isConnected) return <>{children}</>

  return (
    <Button
      key="connect"
      type="primary"
      onClick={() => appKitModal?.open({ view: 'Connect' })}
    >
      Connect
    </Button>
  )
}

export default EnsureAuth
