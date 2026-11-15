import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import useUrlChainId from 'hooks/use-url-chain-id'
import { governorNeedsWallet } from 'config/tcr-addresses'

/**
 * While a step form is on screen it owns its governor field (it writes its
 * values back over the wizard's state), so the wallet fills the governor
 * here, through the form, as the wizard's state does: when the wallet
 * connects or changes (also when the form opens with a wallet already
 * connected), an empty or placeholder governor takes it; the chain's
 * placeholder is replaced at any time. A governor emptied while editing
 * stays empty, so a pasted address is not added to the wallet's.
 */
const useWalletGovernor = (
  value: string | undefined,
  setValue: (address: string) => void,
) => {
  const { address: account } = useAccount()
  const chainId = useUrlChainId() ?? undefined
  // The wallet this form last saw; none yet when it opens.
  const seen = useRef<string | undefined>(undefined)
  const placeholder = !!value && governorNeedsWallet(value, chainId)
  useEffect(() => {
    const walletChanged = account !== seen.current
    seen.current = account
    if (!account) return
    if (placeholder || (walletChanged && governorNeedsWallet(value, chainId)))
      setValue(account)
    // Only a wallet change or a placeholder fills the field: the value
    // itself is read, not watched. setValue is Formik's setFieldValue,
    // recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, placeholder])
}

export default useWalletGovernor
