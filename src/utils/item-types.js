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

export const typeToSolidity = {
  [ADDRESS]: 'address',
  [NUMBER]: 'int256',
  [TEXT]: 'string',
  [BOOLEAN]: 'bool'
}

export const typeDefaultValues = {
  [ADDRESS]: '',
  [TEXT]: '',
  [BOOLEAN]: false,
  [NUMBER]: 0
}
