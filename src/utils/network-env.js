import { NETWORK } from './network-utils'

/**
 * Fetch an environment variable for a given networkId.
 * @param {string} envVariableKey The environment variable to fetch.
 * @param {number} networkId The network Id.
 * @returns {*} The variable content for the networkId.
 */
function getNetworkEnv(envVariableKey, networkId) {
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

  if (data === '')
    console.warn(
      `Warning: no value found for ${envVariableKey}, networkId: ${networkId}`
    )

  return data
}

export default getNetworkEnv
