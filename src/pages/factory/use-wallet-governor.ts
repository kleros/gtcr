import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import useUrlChainId from 'hooks/use-url-chain-id'
import { governorNeedsWallet } from 'config/tcr-addresses'

/**
 * While a step form is on screen it owns its governor field (it writes its
 * values back over the wizard's state), so the wallet fills an empty or
 * placeholder governor here, through the form, when it connects.
 */
const useWalletGovernor = (
  value: string | undefined,
  setValue: (address: string) => void,
) => {
  const { address: account } = useAccount()
  const chainId = useUrlChainId() ?? undefined
  const needsWallet = governorNeedsWallet(value, chainId)
  useEffect(() => {
    if (account && needsWallet) setValue(account)
    // setValue is Formik's setFieldValue, recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, needsWallet])
}

export default useWalletGovernor
