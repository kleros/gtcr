import { solidityTypes, typeToSolidity } from './item-types'
import * as BN from 'bn.js'
import * as RLP from 'rlp'
import { toUtf8String } from 'ethers/utils'

const bufferToHex = buf => {
  buf = buf.toString('hex')
  if (buf.substring(0, 2) === '0x') return buf
  return `0x${buf.toString('hex')}`
}

const MAX_SIGNED_INTEGER = new BN(1).iushln(255).sub(new BN(1)) //  int(~(uint(1) << 255))
const MIN_SIGNED_INTEGER = new BN(1).iushln(255).neg() // int(uint(1) << 255)

// TODO: Handle negative numbers.
export const gtcrEncode = ({ columns, values }) => {
  window.BN = BN
  const itemArr = columns.map(col => {
    switch (typeToSolidity[col.type]) {
      case solidityTypes.STRING:
        return values[col.label]
      case solidityTypes.INT256: {
        if (new BN(values[col.label]).gt(MAX_SIGNED_INTEGER))
          throw new Error('Number exceeds maximum supported signed integer.')
        if (new BN(values[col.label]).lt(MIN_SIGNED_INTEGER))
          throw new Error(
            'Number smaller than minimum supported signed integer.'
          )
        return new BN(values[col.label]).toTwos(256)
      }
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

// TODO: Add over/underflow checks for numbers greated or smaller than
// MAX_SIGNED_INTEGER and MIN_SINED_INTEGER and mark the item in the UI.
export const gtcrDecode = ({ columns, values }) => {
  const item = RLP.decode(values)
  return columns.map((col, i) => {
    switch (typeToSolidity[col.type]) {
      case solidityTypes.STRING:
        return toUtf8String(item[i])
      case solidityTypes.INT256:
        return new BN(item[i], 16).fromTwos(256).toString(10)
      case solidityTypes.ADDRESS:
        return `0x${item[i].toString('hex')}`
      case solidityTypes.BOOL:
        return Boolean(new BN(item[i].toString('hex'), 16).toNumber())
      default:
        throw new Error(`Unhandled item type ${col.type}`)
    }
  })
}
