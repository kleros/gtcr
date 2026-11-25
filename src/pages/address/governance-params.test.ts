import { describe, expect, it } from 'vitest'
// The app's client (react-query keeps its own copy of query-core).
import { QueryClient } from '@tanstack/react-query'
import {
  arbitrationExtraData,
  buildArbitratorExtraData,
  markListSettingsStale,
  newGovernorCodeNote,
  parseParamValue,
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

describe('newGovernorCodeNote', () => {
  const target = '0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe'

  it('reminds that a Safe must exist on the chain when the address holds no contract', () => {
    expect(
      newGovernorCodeNote(
        { address: target, contract: false },
        target,
        'Gnosis',
      ),
    ).toBe(
      ' There is no contract at that address on Gnosis: fine for a personal wallet, but a Safe must exist on Gnosis itself.',
    )
  })

  it('says when the address could not be checked, rather than saying nothing', () => {
    expect(
      newGovernorCodeNote(
        { address: target, contract: null },
        target,
        'Gnosis',
      ),
    ).toBe(
      ' Whether there is a contract at that address on Gnosis could not be checked: a Safe must exist on Gnosis itself.',
    )
  })

  it('adds nothing for a contract, before the read lands, or from a read of another address', () => {
    expect(
      newGovernorCodeNote(
        { address: target, contract: true },
        target,
        'Gnosis',
      ),
    ).toBe('')
    expect(newGovernorCodeNote(undefined, target, 'Gnosis')).toBe('')
    expect(
      newGovernorCodeNote(
        {
          address: '0x1111111111111111111111111111111111111111',
          contract: false,
        },
        target,
        'Gnosis',
      ),
    ).toBe('')
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
