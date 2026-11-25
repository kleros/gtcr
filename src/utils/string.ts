import { ethers, BigNumber } from 'ethers'

const { getAddress } = ethers.utils

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const isVowel = (x: string): boolean => /[aeiouAEIOU]/.test(x)

export const capitalizeFirstLetter = (str: string): string =>
  str && str.length > 0 ? str.charAt(0).toUpperCase() + str.slice(1) : str

export const isETHAddress = (address: string): boolean => {
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

export const jurorsAndCourtIDFromExtraData = (
  arbitratorExtraData: string,
): { courtID: number; numberOfJurors: number } => {
  const courtID = BigNumber.from(
    `0x${arbitratorExtraData.slice(2, 66)}`,
  ).toNumber()

  const numberOfJurors = BigNumber.from(
    `0x${arbitratorExtraData.slice(66, 130)}`,
  ).toNumber()

  return { courtID, numberOfJurors }
}

/** The court and juror count in arbitrator extra data, or null if it does not decode. */
export const readExtraData = (
  extraData?: string,
): { courtID: number; numberOfJurors: number } | null => {
  if (!extraData) return null
  try {
    return jurorsAndCourtIDFromExtraData(extraData)
  } catch {
    return null
  }
}

/** Kleros arbitrator extra data: the court id, then the juror count, 32 bytes each. */
export const encodeExtraData = (courtID: number, numberOfJurors: number) =>
  `0x${courtID.toString(16).padStart(64, '0')}${Math.ceil(numberOfJurors)
    .toString(16)
    .padStart(64, '0')}`

// Letters whose spoken name starts with a vowel sound ("an NFT", "an SDK").
const VOWEL_SOUND_LETTERS = /^[AEFHILMNORSX]/
// Vowel letters read with a consonant sound ("a user", "a euro", "a one-off").
const CONSONANT_SOUND_START =
  // No "n" in the class: "an unusual", "an unofficial"; only "unanimous"
  // and "unary" start with the "you-n" sound.
  /^(u[bcfgklmprstvz][aeiou]|unanim|unary|uni|eu|ewe|one\b|once\b|uk\b)/i
// A silent h ("an hour", "an honest mistake").
const SILENT_H_START = /^(hour|honest|honou?r|heir)/i

/**
 * "a" or "an" for the word that follows, by how it sounds rather than how it
 * is spelled: a user, a euro, an hour, an NFT, a URL.
 */
export const getArticleFor = (str: string): string => {
  const word = (str || '').trim().split(/[\s-]/)[0] ?? ''
  if (!word) return 'a'
  if (/^[A-Z]{2,}\d*$/.test(word))
    return VOWEL_SOUND_LETTERS.test(word) ? 'an' : 'a'
  if (/^(8|11|18)/.test(word)) return 'an'
  if (SILENT_H_START.test(word)) return 'an'
  if (CONSONANT_SOUND_START.test(word)) return 'a'
  return isVowel(word[0]) ? 'an' : 'a'
}

export const SAVED_NETWORK_KEY = 'SAVED_NETWORK_KEY'

export const addPeriod = (input: string = ''): string => {
  if (input.length === 0) return ''
  // A question or an exclamation already ends its sentence.
  return /[.?!]$/.test(input) ? input : `${input}.`
}
