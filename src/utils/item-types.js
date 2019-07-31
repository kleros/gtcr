// The maps types available for a TCR item column to their lengths in bytes.
// Items marked with null are not stored on-chain.

export const ADDRESS = 'address'
export const NUMBER = 'number'
export const TEXT = 'text'
export const LONGTEXT = 'longtext'
export const BOOLEAN = 'boolean'

export default {
  [ADDRESS]: 20,
  [NUMBER]: 32,
  [TEXT]: 64,
  [LONGTEXT]: null,
  [BOOLEAN]: 1
}
