import { describe, expect, it } from 'vitest'
// The app's client (react-query keeps its own copy of query-core).
import { QueryClient } from '@tanstack/react-query'
import {
  arbitrationEffect,
  arbitrationExtraData,
  buildArbitratorExtraData,
  columnsChange,
  governorTargetNote,
  markListSettingsStale,
  paramEffect,
  parseParamValue,
  reviewValue,
  type ParamConfig,
} from './governance-params'

const period: ParamConfig = {
  key: 'challengePeriodDuration',
  label: 'Challenge period (days)',
  kind: 'seconds',
  positive: true,
  functionName: 'changeChallengePeriodDuration',
  group: 'timing',
  help: '',
}

const percent: ParamConfig = {
  key: 'sharedStakeMultiplier',
  label: 'Appeal stake, no winner (%)',
  kind: 'multiplier',
  functionName: 'changeSharedStakeMultiplier',
  group: 'timing',
  help: '',
}

describe('parseParamValue', () => {
  it('reads days as whole seconds and a percent as basis points', () => {
    expect(parseParamValue('3.5', period, {})).toEqual({ value: 302_400n })
    expect(parseParamValue('0,5', period, {})).toEqual({ value: 43_200n })
    expect(parseParamValue('0', period, {})).toEqual({
      error: 'Must be longer than 0',
    })
    expect(parseParamValue('12.5', percent, {})).toEqual({ value: 1_250n })
  })

  it('refuses a number too large to read exactly, rather than throwing while the field renders', () => {
    // 304 nines of days, or 307 of a percent, came out as Infinity, and
    // BigInt(Infinity) threw a RangeError that took the page down.
    expect(parseParamValue('9'.repeat(304), period, {})).toEqual({
      error: 'Too long',
    })
    expect(parseParamValue('9'.repeat(307), percent, {})).toEqual({
      error: 'Too large',
    })
    // Short of that, past 2^53 seconds the value sent was not the value
    // typed: these days came out 218,368 seconds short.
    expect(parseParamValue('123456789012345678', period, {})).toEqual({
      error: 'Too long',
    })
  })

  it('still reads the longest period it can read exactly', () => {
    expect(parseParamValue('104249991374', period, {})).toEqual({
      value: 104_249_991_374n * 86_400n,
    })
  })
})

const word = (value: number) => value.toString(16).padStart(64, '0')
/** Court 1, three jurors: the Kleros layout the court fields read. */
const COURT_1 = buildArbitratorExtraData(1, 3)
/** The same two words and a third the court fields cannot show. */
const THREE_WORDS = `${COURT_1}${word(2)}`

describe('arbitrationExtraData', () => {
  const policyOnly = { courtEdited: false, arbitratorChanged: false }

  it('sends a Kleros court back as it is when only the MetaEvidence changes', () => {
    expect(
      arbitrationExtraData({
        current: COURT_1,
        courtID: '1',
        jurors: '3',
        ...policyOnly,
      }),
    ).toEqual({ value: COURT_1 })
  })

  it('sends any other extra data back byte for byte, never re-encoded as a court and jurors', () => {
    expect(
      arbitrationExtraData({
        current: THREE_WORDS,
        courtID: '1',
        jurors: '3',
        ...policyOnly,
      }),
    ).toEqual({ value: THREE_WORDS })
    // A juror count the fields would refuse is still the list's own.
    const evenJurors = buildArbitratorExtraData(1, 2)
    expect(
      arbitrationExtraData({
        current: evenJurors,
        courtID: '1',
        jurors: '2',
        ...policyOnly,
      }),
    ).toEqual({ value: evenJurors })
  })

  it('asks for no court when the list holds none the fields can read', () => {
    for (const current of ['0x', `0x${word(7)}`])
      expect(
        arbitrationExtraData({
          current,
          courtID: '',
          jurors: '3',
          ...policyOnly,
        }),
      ).toEqual({ value: current })
  })

  it("keeps the list's bytes when the court is changed and put back", () => {
    expect(
      arbitrationExtraData({
        current: THREE_WORDS,
        courtID: '1',
        jurors: '3',
        courtEdited: true,
        arbitratorChanged: false,
      }),
    ).toEqual({ value: THREE_WORDS })
  })

  it('builds the extra data from the fields once the court, the jurors or the arbitrator change', () => {
    const edit = {
      current: COURT_1,
      courtEdited: true,
      arbitratorChanged: false,
    }
    expect(
      arbitrationExtraData({ ...edit, courtID: '2', jurors: '3' }),
    ).toEqual({ value: buildArbitratorExtraData(2, 3) })
    expect(
      arbitrationExtraData({ ...edit, courtID: '1', jurors: '5' }),
    ).toEqual({ value: buildArbitratorExtraData(1, 5) })
    // A new arbitrator reads the court the fields hold, as before.
    expect(
      arbitrationExtraData({
        current: THREE_WORDS,
        courtID: '1',
        jurors: '3',
        courtEdited: false,
        arbitratorChanged: true,
      }),
    ).toEqual({ value: COURT_1 })
  })

  it('says what is missing from a court it has to build', () => {
    expect(
      arbitrationExtraData({
        current: '0x',
        courtID: '',
        jurors: '3',
        courtEdited: true,
        arbitratorChanged: false,
      }),
    ).toEqual({ error: 'Choose a court' })
    expect(
      arbitrationExtraData({
        current: '0x',
        courtID: '',
        jurors: '3',
        courtEdited: false,
        arbitratorChanged: true,
      }),
    ).toEqual({ error: 'Choose a court' })
    expect(
      arbitrationExtraData({
        current: COURT_1,
        courtID: '1',
        jurors: '4',
        courtEdited: true,
        arbitratorChanged: false,
      }),
    ).toEqual({ error: 'Jurors: Use an odd number, so votes cannot tie' })
  })
})

describe('reviewValue', () => {
  it('shows an amount with its symbol, and the wei it is stored as', () => {
    expect(reviewValue('500000000000000000', 'wei', {}, 'xDAI')).toEqual({
      shown: '0.5 xDAI',
      stored: '500,000,000,000,000,000 wei',
    })
  })

  it("shows a token amount in the token's own decimals", () => {
    expect(
      reviewValue(1_500_000n, 'token', { tokenDecimals: 6 }, 'USDC'),
    ).toEqual({ shown: '1.5 USDC', stored: '1,500,000 base units' })
  })

  it('shows a period in words and a stake as a percent', () => {
    expect(reviewValue('302400', 'seconds', {})).toEqual({
      shown: '3 days 12 hours',
      stored: '302,400 s',
    })
    expect(reviewValue(15_000n, 'multiplier', {})).toEqual({
      shown: '150%',
      stored: '15,000 basis points',
    })
  })

  it('shows an address whole, and nothing for no value', () => {
    const address = '0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe'
    expect(reviewValue(address, 'address', {})).toEqual({ shown: address })
    expect(reviewValue(undefined, 'wei', {})).toBeUndefined()
    expect(reviewValue('', 'seconds', {})).toBeUndefined()
  })
})

describe('what a change does to what is under way', () => {
  it('says which settings reach requests already made, as the contracts read them', () => {
    // Read in addItem: only new requests pay it.
    expect(paramEffect('submissionBaseDeposit')).toMatch(/made from now on/)
    // Read in challengeRequest and executeRequest: requests waiting too.
    expect(paramEffect('challengePeriodDuration')).toMatch(/at once/)
    expect(paramEffect('submissionChallengeBaseDeposit')).toMatch(
      /already waiting/,
    )
    // Read in fundAppeal: disputes already open too.
    expect(paramEffect('loserStakeMultiplier')).toMatch(/disputes already open/)
    // Stake's periods: never read on chain.
    expect(paramEffect('submissionPeriod')).toMatch(/never reads it/)
    expect(paramEffect('withdrawingPeriod')).toMatch(/already withdrawing/)
  })

  it('names the cooldown after which a Stake change reaches listed entries', () => {
    expect(arbitrationEffect('standard')).toMatch(/keep theirs/)
    expect(arbitrationEffect('permanent', 7 * 86_400)).toMatch(
      /cooldown \(7 days\)/,
    )
    expect(arbitrationEffect('permanent')).toMatch(/the list's cooldown has/)
    expect(arbitrationEffect('permanent', 0)).toMatch(/no cooldown/)
  })
})

describe('columnsChange', () => {
  const live = [
    { label: 'Address', type: 'address' },
    { label: 'Name', type: 'text' },
  ]

  it('takes the same columns, and new ones after the last', () => {
    expect(columnsChange(live, live)).toBe('same')
    expect(
      columnsChange([...live, { label: 'Website', type: 'link' }], live),
    ).toBe('appended')
  })

  it('refuses a column renamed, retyped, moved or removed', () => {
    expect(
      columnsChange([live[0], { label: 'Title', type: 'text' }], live),
    ).toBe('changed')
    expect(
      columnsChange([live[0], { label: 'Name', type: 'long text' }], live),
    ).toBe('changed')
    expect(columnsChange([live[1], live[0]], live)).toBe('changed')
    expect(columnsChange([live[0]], live)).toBe('changed')
  })
})

describe('governorTargetNote', () => {
  it('refuses a list: it never sends a transaction', () => {
    expect(governorTargetNote({ kind: 'list' }, 'Gnosis').refusal).toMatch(
      /nobody could change this list again/,
    )
  })

  it('names a Safe by its threshold', () => {
    expect(
      governorTargetNote({ kind: 'safe', threshold: 2, owners: 4 }, 'Gnosis'),
    ).toEqual({
      note: 'A Safe on Gnosis: 2 of its 4 owners sign each change.',
    })
  })

  it('warns of a contract that is no Safe, and of an address it could not read', () => {
    expect(governorTargetNote({ kind: 'contract' }, 'Gnosis')).toMatchObject({
      warning: true,
    })
    expect(governorTargetNote({ kind: 'unknown' }, 'Gnosis')).toMatchObject({
      warning: true,
    })
  })

  it('reminds that a Safe must exist on the chain itself when the address holds no contract', () => {
    // Two Gnosis lists name the Ethereum Kleros Governor, which has no code
    // on Gnosis: nobody can change them any more.
    const { note, refusal } = governorTargetNote({ kind: 'wallet' }, 'Gnosis')
    expect(refusal).toBeUndefined()
    expect(note).toMatch(/must exist on Gnosis itself/)
  })
})

describe('markListSettingsStale', () => {
  it("marks other pages' reads of the list's MetaEvidence and settings stale, and nothing else", async () => {
    const queryClient = new QueryClient()
    const list = {
      chainId: 100,
      address: '0xabcdef0123456789abcdef0123456789abcdef01',
    }
    // The keys the pages use (hooks/standard-tcr-view.ts,
    // hooks/use-tcr-meta-evidence.ts, components/curate/list-governance.tsx).
    // The list page's key holds the address as the URL spells it.
    const listPage = [
      'metaEvidence',
      'standard',
      '0xABCDEF0123456789abcdef0123456789ABCDEF01',
      100,
    ]
    const otherPages = ['tcrMetaEvidence', list.address, 100]
    const listButton = ['listGovernance', 100, list.address]
    const otherList = [
      'metaEvidence',
      'standard',
      '0x1111111111111111111111111111111111111111',
      100,
    ]
    const otherChain = ['metaEvidence', 'standard', list.address, 1]
    const entries = ['standardItems', { registryId: list.address }]
    const keys = [
      listPage,
      otherPages,
      listButton,
      otherList,
      otherChain,
      entries,
    ]
    for (const key of keys) queryClient.setQueryData(key, { cached: true })

    await markListSettingsStale(queryClient, list)

    const stale = (key: unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated
    expect(stale(listPage)).toBe(true)
    expect(stale(otherPages)).toBe(true)
    expect(stale(listButton)).toBe(true)
    expect(stale(otherList)).toBe(false)
    expect(stale(otherChain)).toBe(false)
    expect(stale(entries)).toBe(false)
    // Marked, not fetched: nothing here has a query function to call.
    expect(queryClient.getQueryData(listPage)).toEqual({ cached: true })
  })
})
