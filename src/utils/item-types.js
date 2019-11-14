const ADDRESS = 'address'
const NUMBER = 'number'
const TEXT = 'text'
const BOOLEAN = 'boolean'
const GTCR_ADDRESS = 'GTCR address'

export default {
  ADDRESS,
  NUMBER,
  TEXT,
  BOOLEAN,
  GTCR_ADDRESS
}

export const solidityTypes = {
  ADDRESS: 'address',
  INT256: 'int256',
  STRING: 'string',
  BOOL: 'bool',
  GTCR_ADDRESS: 'address'
}

export const typeToSolidity = {
  [ADDRESS]: solidityTypes.ADDRESS,
  [NUMBER]: solidityTypes.INT256,
  [TEXT]: solidityTypes.STRING,
  [BOOLEAN]: solidityTypes.BOOL,
  [GTCR_ADDRESS]: solidityTypes.GTCR_ADDRESS
}

export const typeDefaultValues = {
  [ADDRESS]: '',
  [TEXT]: '',
  [BOOLEAN]: false,
  [NUMBER]: 0,
  [GTCR_ADDRESS]: ''
}
