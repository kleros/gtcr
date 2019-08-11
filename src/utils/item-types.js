const ADDRESS = 'address'
const NUMBER = 'number'
const TEXT = 'text'
const BOOLEAN = 'boolean'

export default {
  ADDRESS,
  NUMBER,
  TEXT,
  BOOLEAN
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
  [BOOLEAN]: solidityTypes.BOOL
}

export const typeDefaultValues = {
  [ADDRESS]: '',
  [TEXT]: '',
  [BOOLEAN]: false,
  [NUMBER]: 0
}
