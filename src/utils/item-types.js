const ADDRESS = 'address'
const NUMBER = 'number'
const TEXT = 'text'
const BOOLEAN = 'boolean'
const GTCR_ADDRESS = 'GTCR address'
const IMAGE = 'image'

export default {
  ADDRESS,
  NUMBER,
  TEXT,
  BOOLEAN,
  GTCR_ADDRESS,
  IMAGE
}

export const solidityTypes = {
  ADDRESS: 'address',
  INT256: 'int256',
  STRING: 'string',
  BOOL: 'bool'
}

export const typeToSolidity = {
  [ADDRESS]: solidityTypes.ADDRESS,
  [NUMBER]: solidityTypes.INT256,
  [TEXT]: solidityTypes.STRING,
  [BOOLEAN]: solidityTypes.BOOL,
  [GTCR_ADDRESS]: solidityTypes.ADDRESS,
  [IMAGE]: solidityTypes.STRING
}

export const typeDefaultValues = {
  [ADDRESS]: '',
  [TEXT]: '',
  [BOOLEAN]: false,
  [NUMBER]: 0,
  [GTCR_ADDRESS]: '',
  [IMAGE]: ''
}

export const searchableFields = [ADDRESS, GTCR_ADDRESS, TEXT]
