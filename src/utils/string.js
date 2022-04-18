import { keccak256, getAddress, bigNumberify } from 'ethers/utils'

export const truncateETHAddress = ethAddr =>
  `${ethAddr.slice(0, 5)}...${ethAddr.slice(40)}`

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

export const sanitize = str =>
  str
    .toString()
    .toLowerCase()
    .replace(/([^a-z0-9.]+)/gi, '-') // Only allow numbers and aplhanumeric.

export const LOREM_IPSUM = `Natus ipsam unde et accusamus. Autem et laboriosam non harum voluptas necessitatibus commodi. Enim suscipit cumque aut voluptas quibusdam soluta quis. Velit modi dolores voluptate pariatur. Eligendi veniam aut esse. Aut nam itaque repellendus explicabo dolores.

Voluptates magnam error sequi occaecati facere.`

export const isVowel = x => /[aeiouAEIOU]/.test(x)

export const capitalizeFirstLetter = str =>
  str && str.length > 0 ? str.charAt(0).toUpperCase() + str.slice(1) : str

export const isChecksumAddress = address => {
  // Check each case
  var addressHash = keccak256(address.toLowerCase())
  for (var i = 0; i < 40; i++)
    // the nth letter should be uppercase if the nth digit of casemap is 1
    if (
      (parseInt(addressHash[i], 16) > 7 &&
        address[i].toUpperCase() !== address[i]) ||
      (parseInt(addressHash[i], 16) <= 7 &&
        address[i].toLowerCase() !== address[i])
    )
      return false

  return true
}

export const isETHAddress = address => {
  if (!address) return false
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) return false
  else if (
    /^(0x)?[0-9a-f]{40}$/.test(address) ||
    /^(0x)?[0-9A-F]{40}$/.test(address)
  )
    return true
  else
    try {
      getAddress(address)
      return true
    } catch {
      return false
    }
}

export const jurorsAndCourtIDFromExtraData = arbitratorExtraData => {
  const courtID = bigNumberify(
    `0x${arbitratorExtraData.slice(2, 66)}`
  ).toNumber()

  const numberOfJurors = bigNumberify(
    `0x${arbitratorExtraData.slice(66, 130)}`
  ).toNumber()

  return { courtID, numberOfJurors }
}

export const getArticleFor = str => (str && isVowel(str[0]) ? 'an' : 'a')

export const SAVED_NETWORK_KEY = 'SAVED_NETWORK_KEY'

export const addPeriod = (input = '') => {
  if (input.length === 0) return ''
  return input[input.length - 1] === '.' ? input : `${input}.`
}

export const hexlify = number => {
  if (!number) return '0x00'
  else return `0x${Number(number).toString(16)}`
}
