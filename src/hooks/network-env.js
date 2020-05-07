import { NETWORK } from '../utils/network-utils'

const useNetworkEnvVariable = (envVariableKey, networkId) => {
  const defaultNetwork =
    process.env.REACT_APP_DEFAULT_NETWORK || NETWORK.MAINNET
  let data = ''
  try {
    data = process.env[envVariableKey]
      ? JSON.parse(process.env[envVariableKey])[networkId || defaultNetwork]
      : ''
  } catch (_) {
    console.error(`Failed to parse env variable ${envVariableKey}`)
  }

  return data
}

export default useNetworkEnvVariable
