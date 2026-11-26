import { describe, expect, it } from 'vitest'
import type { providers } from 'ethers'
import { isPolicyLog, policyLogs } from './fetch-policy-history'
import { policyKindOf } from 'hooks/use-policy-history'

/** A MetaEvidence event as getLogs returns it: the id is topics[1]. */
const log = (id: number, blockNumber: number, tx = `0xtx${id}`) =>
  ({
    blockNumber,
    blockHash: `0xblock${blockNumber}`,
    transactionIndex: 0,
    removed: false,
    address: '0x0000000000000000000000000000000000000001',
    data: '0x',
    topics: [
      '0x61606860eb6c87306811e2695215385101daab53bd6ab4e9f9049aead9363c7d',
      `0x${id.toString(16).padStart(64, '0')}`,
    ],
    transactionHash: tx,
    logIndex: id,
  }) as providers.Log

const ids = (logs: providers.Log[]) =>
  logs.map((l) => Number(BigInt(l.topics[1])))

describe('which MetaEvidence events are the policy', () => {
  // LightGeneralizedTCR emits 2n (registration) and 2n + 1 (clearing) per
  // change, in one transaction.
  const standard = [
    log(0, 10, '0xdeploy'),
    log(1, 10, '0xdeploy'),
    log(2, 20, '0xchange'),
    log(3, 20, '0xchange'),
  ]

  it('on Standard, the registration files: the even ids', () => {
    expect(ids(policyLogs(standard, 'standard'))).toEqual([0, 2])
    expect(isPolicyLog('standard')(standard[1])).toBe(false)
  })

  it('on Stake, every event: one per change, the first at deployment', () => {
    const stake = [log(0, 10), log(1, 30), log(2, 40)]
    expect(ids(policyLogs(stake, 'permanent'))).toEqual([0, 1, 2])
  })

  it('orders by id, so two changes in one transaction keep their order', () => {
    // A Safe batch: two changes of one list in one block, read out of order.
    const batched = [log(6, 50, '0xbatch'), log(4, 50, '0xbatch'), log(5, 50)]
    expect(ids(policyLogs(batched, 'permanent'))).toEqual([4, 5, 6])
    expect(
      ids(policyLogs([log(7, 9), log(4, 9), log(5, 9), log(6, 9)], 'standard')),
    ).toEqual([4, 6])
  })
})

describe('the kind a router has found', () => {
  it('is unknown while it checks, and for a retired Classic list', () => {
    expect(
      policyKindOf({
        checking: true,
        isStandardCurate: true,
        isPermanentCurate: false,
      }),
    ).toBeUndefined()
    expect(
      policyKindOf({
        checking: false,
        isStandardCurate: false,
        isPermanentCurate: false,
      }),
    ).toBeUndefined()
  })

  it('names Standard and Stake once the check is done', () => {
    expect(
      policyKindOf({
        checking: false,
        isStandardCurate: true,
        isPermanentCurate: false,
      }),
    ).toBe('standard')
    expect(
      policyKindOf({
        checking: false,
        isStandardCurate: false,
        isPermanentCurate: true,
      }),
    ).toBe('permanent')
  })
})
