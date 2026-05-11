import React, { useCallback } from 'react'
import { Button } from 'components/ui'
import { useAccount } from 'wagmi'
import { useAtlasProvider } from '@kleros/kleros-app'
import { appKitModal } from 'config/wagmi'
import { infoToast, successToast, errorToast } from 'utils/wrap-with-toast'

/**
 * Wraps an action button and shows a "Connect" or "Sign in" button
 * when the user is not yet connected or authenticated with Atlas.
 * The wrapped action only renders once both gates are satisfied.
 */
interface EnsureAuthProps {
  children: React.ReactNode
}

const EnsureAuth = ({ children }: EnsureAuthProps) => {
  const { isConnected } = useAccount()
  const { isVerified, isSigningIn, authoriseUser } = useAtlasProvider()

  const handleSignIn = useCallback(() => {
    infoToast('Signing in...')
    authoriseUser()
      .then(() => successToast('Signed in successfully.'))
      .catch((err) => {
        console.error(err)
        errorToast(`Sign-in failed: ${err?.message ?? 'unknown error'}`)
      })
  }, [authoriseUser])

  if (!isConnected)
    return (
      <Button
        key="connect"
        type="primary"
        onClick={() => appKitModal?.open({ view: 'Connect' })}
      >
        Connect
      </Button>
    )

  if (!isVerified)
    return (
      <Button
        key="sign-in"
        type="primary"
        loading={isSigningIn}
        onClick={handleSignIn}
      >
        Sign in
      </Button>
    )

  return <>{children}</>
}

export default EnsureAuth
