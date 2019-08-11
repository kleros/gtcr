import { solidityTypes, typeToSolidity } from './item-types'
import * as BN from 'bn.js'
import * as RLP from 'rlp'
import { toUtf8String } from 'ethers/utils'

const bufferToHex = buf => {
  buf = buf.toString('hex')
  if (buf.substring(0, 2) === '0x') return buf
  return `0x${buf.toString('hex')}`
}

export const gtcrEncode = ({ columns, values }) => {
  const itemArr = columns.map(col => {
    switch (typeToSolidity[col.type]) {
      case solidityTypes.STRING:
        return values[col.label]
      case solidityTypes.INT256:
        return new BN(values[col.label])
      case solidityTypes.ADDRESS:
        return new BN(values[col.label].slice(2), 16)
      case solidityTypes.BOOL:
        return new BN(values[col.label] ? 1 : 0)
      default:
        throw new Error(`Unhandled item type ${col.type}`)
    }
  })

  return bufferToHex(RLP.encode(itemArr))
}

export const gtcrDecode = ({ columns, values }) => {
  const item = RLP.decode(values)
  return columns.map((col, i) => {
    switch (typeToSolidity[col.type]) {
      case solidityTypes.STRING:
        return toUtf8String(item[i])
      case solidityTypes.INT256:
        return new BN(item[i].toString('hex'), 16).toString()
      case solidityTypes.ADDRESS:
        return `0x${item[i].toString('hex')}`
      case solidityTypes.BOOL:
        return Boolean(new BN(item[i].toString('hex'), 16).toNumber())
      default:
        throw new Error(`Unhandled item type ${col.type}`)
    }
  })
}
