import { describe, expect, it } from 'vitest'
import {
  addPeriod,
  capitalizeFirstLetter,
  encodeExtraData,
  getArticleFor,
  isETHAddress,
  isVowel,
  jurorsAndCourtIDFromExtraData,
  readExtraData,
  ZERO_ADDRESS,
} from './string'

// EIP-55's own test vectors.
const CHECKSUMMED = [
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
]

const word = (hex: string) => hex.padStart(64, '0')

describe('isETHAddress', () => {
  it.each(CHECKSUMMED)('accepts the checksummed address %s', (address) => {
    expect(isETHAddress(address)).toBe(true)
  })

  it('accepts an address written in one case, which carries no checksum', () => {
    expect(isETHAddress(CHECKSUMMED[0].toLowerCase())).toBe(true)
    expect(isETHAddress(`0x${CHECKSUMMED[0].slice(2).toUpperCase()}`)).toBe(
      true,
    )
    expect(isETHAddress(ZERO_ADDRESS)).toBe(true)
  })

  it('refuses a mixed-case address whose checksum is wrong', () => {
    // The last letter's case flipped: a typo the checksum exists to catch.
    expect(isETHAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD')).toBe(
      false,
    )
  })

  it.each([
    ['empty', ''],
    ['too short', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe'],
    ['too long', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed0'],
    ['not hex', `0x${'g'.repeat(40)}`],
    ['an uppercase prefix', `0X${'a'.repeat(40)}`],
    ['an ENS name', 'vitalik.eth'],
    ['spaces around it', ` ${CHECKSUMMED[0]} `],
  ])('refuses %s', (_, address) => {
    expect(isETHAddress(address)).toBe(false)
  })
})

describe('arbitrator extra data', () => {
  it.each([
    [0, 1],
    [0, 3],
    [1, 5],
    [23, 511],
    [4_294_967_296, 1],
  ])(
    'reads back court %i with %i jurors as it was encoded',
    (courtID, numberOfJurors) => {
      const extraData = encodeExtraData(courtID, numberOfJurors)
      expect(extraData).toMatch(/^0x[\da-f]{128}$/)
      expect(readExtraData(extraData)).toEqual({ courtID, numberOfJurors })
    },
  )

  it('writes the court id, then the juror count, 32 bytes each', () => {
    expect(encodeExtraData(2, 3)).toBe(`0x${word('2')}${word('3')}`)
  })

  it('rounds a fractional juror count up: never fewer jurors than asked', () => {
    expect(readExtraData(encodeExtraData(1, 2.2))).toEqual({
      courtID: 1,
      numberOfJurors: 3,
    })
  })

  it('reads uppercase hex and ignores bytes after the juror count', () => {
    expect(
      jurorsAndCourtIDFromExtraData(`0x${word('1A')}${word('B')}${word('ff')}`),
    ).toEqual({ courtID: 26, numberOfJurors: 11 })
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['no bytes', '0x'],
    ['a court with no juror count', `0x${word('1')}`],
    ['not hex', `0x${'z'.repeat(128)}`],
    [
      'a juror count past what a number holds',
      `0x${word('1')}${'f'.repeat(64)}`,
    ],
  ])('readExtraData gives null for %s', (_, extraData) => {
    expect(readExtraData(extraData)).toBeNull()
  })

  it('jurorsAndCourtIDFromExtraData throws on what does not decode', () => {
    expect(() => jurorsAndCourtIDFromExtraData('0x')).toThrow()
  })
})

describe('getArticleFor', () => {
  it.each([
    // The examples the code documents.
    ['user', 'a'],
    ['euro', 'a'],
    ['one-off', 'a'],
    ['hour', 'an'],
    ['honest mistake', 'an'],
    ['NFT', 'an'],
    ['SDK', 'an'],
    ['URL', 'a'],
    // Spelling and sound agree.
    ['token', 'a'],
    ['entry', 'an'],
    ['address', 'an'],
    ['item', 'an'],
    ['Apple', 'an'],
    // A vowel letter read as a consonant.
    ['unicorn', 'a'],
    ['utility', 'a'],
    ['usual', 'a'],
    ['European', 'a'],
    ['ewe', 'a'],
    ['once', 'a'],
    ['User', 'a'],
    // A "u" that is a vowel sound.
    ['umbrella', 'an'],
    ['under', 'an'],
    // A silent h, and an h that is heard.
    ['heir', 'an'],
    ['honour', 'an'],
    ['Hour', 'an'],
    ['hotel', 'a'],
    ['house', 'a'],
    // Letters spelled out.
    ['FAQ', 'an'],
    ['HTML', 'an'],
    ['MP3', 'an'],
    ['ERC-20', 'an'],
    ['USDC', 'a'],
    ['UK', 'a'],
    // Numbers, by how they are read.
    ['8-bit', 'an'],
    ['80', 'an'],
    ['11', 'an'],
    ['18', 'an'],
    ['1', 'a'],
    ['2', 'a'],
  ])('%s takes "%s"', (text, article) => {
    expect(getArticleFor(text)).toBe(article)
  })

  it('reads only the first word, after any leading space', () => {
    expect(getArticleFor('  apple pie')).toBe('an')
    expect(getArticleFor('hour-long talk')).toBe('an')
  })

  it('says "a" when there is no word', () => {
    expect(getArticleFor('')).toBe('a')
    expect(getArticleFor('   ')).toBe('a')
    expect(getArticleFor(undefined as unknown as string)).toBe('a')
  })

  // Regression: CONSONANT_SOUND_START (string.ts) lists "n" among the consonants in
  // u[bcfgklmnprstvz][aeiou], so every "un-" word followed by a vowel reads
  // as "you-n…": "a unusual entry", "a unofficial list", "a unaudited
  // contract". Only "unanimous" and "unary" sound that way.
  it('says "an" before "un-" words that start with the vowel sound', () => {
    expect(getArticleFor('unusual')).toBe('an')
    expect(getArticleFor('unofficial')).toBe('an')
    expect(getArticleFor('unaudited')).toBe('an')
  })
})

describe('addPeriod', () => {
  it('ends a sentence with one period', () => {
    expect(addPeriod('The token symbol')).toBe('The token symbol.')
    expect(addPeriod('The token symbol.')).toBe('The token symbol.')
  })

  it('leaves nothing as nothing', () => {
    expect(addPeriod('')).toBe('')
    expect(addPeriod()).toBe('')
  })

  // Regression: addPeriod only checks for a period, so a column description
  // written as a question or exclamation gets one more: "Is the contract
  // verified?." under the field on the submit page and in the entry dialogs.
  it('adds no period after a question or exclamation mark', () => {
    expect(addPeriod('Is the contract verified?')).toBe(
      'Is the contract verified?',
    )
    expect(addPeriod('Required!')).toBe('Required!')
  })
})

describe('capitalizeFirstLetter', () => {
  it('capitalizes only the first letter', () => {
    expect(capitalizeFirstLetter('token list')).toBe('Token list')
    expect(capitalizeFirstLetter('éclair')).toBe('Éclair')
    expect(capitalizeFirstLetter('NFT')).toBe('NFT')
  })

  it('leaves nothing as nothing', () => {
    expect(capitalizeFirstLetter('')).toBe('')
    expect(capitalizeFirstLetter(undefined as unknown as string)).toBe(
      undefined,
    )
  })
})

describe('isVowel', () => {
  it.each(['a', 'e', 'i', 'o', 'u', 'A', 'U'])('%s is a vowel', (letter) => {
    expect(isVowel(letter)).toBe(true)
  })

  it.each(['b', 'y', 'H', '1', '-', ''])('%j is not', (letter) => {
    expect(isVowel(letter)).toBe(false)
  })
})
