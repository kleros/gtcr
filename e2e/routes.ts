/*
 * The pages the browser tests open, with real addresses from the
 * recordings: a Standard list and entry on Gnosis and on Ethereum, a Stake
 * list and entry, the Gnosis list of lists, a retired Classic list, and a
 * curator with activity on both list kinds.
 */
export const GNOSIS_LIST = '/tcr/100/0x66260c69d03837016d88c9877e61e08ef74c59f2'
export const GNOSIS_ENTRY = `${GNOSIS_LIST}/0x024547f0c28a4dbe36c491f2adf037cc6d4cd631f3373b397a1c03fcd103f932`
export const ETHEREUM_LIST = '/tcr/1/0x479083b5343ab89bb39608e3176d750c8a6957b5'
export const LIST_OF_LISTS =
  '/tcr/100/0x5f688a4bac5e2787ef1d9de325831e537ee4cffa'
export const STAKE_LIST = '/tcr/100/0x43782f0daebce6ef46ce6250a6296e8af99227eb'
export const STAKE_ENTRY = `${STAKE_LIST}/0x37f253f9d6fd79fad0609d135b567d51e528192a9ae4018fdb1e0e4c9004a5be`
export const RETIRED_CLASSIC_LIST =
  '/tcr/100/0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615'
export const CURATOR = '/address/0x236cca83e44d5330fc32ec97627b03ad71e696c1'

export const ROUTES: { name: string; path: string }[] = [
  { name: 'dashboard', path: '/' },
  { name: 'browse', path: '/browse' },
  { name: 'Standard list (Gnosis)', path: GNOSIS_LIST },
  { name: 'Standard list (Ethereum)', path: ETHEREUM_LIST },
  { name: 'list of lists', path: LIST_OF_LISTS },
  { name: 'Stake list', path: STAKE_LIST },
  { name: 'Standard entry', path: GNOSIS_ENTRY },
  { name: 'Stake entry', path: STAKE_ENTRY },
  { name: 'submit page', path: `${GNOSIS_LIST}/submit` },
  { name: 'retired Classic list', path: RETIRED_CLASSIC_LIST },
  { name: 'curator profile', path: CURATOR },
  { name: 'launch page', path: '/launch/100' },
  { name: 'Standard list wizard', path: '/factory/100' },
  { name: 'Stake list wizard', path: '/factory-permanent/100' },
  { name: 'guide', path: '/guide' },
  { name: 'landing page', path: '/landing/' },
  { name: 'missing page', path: '/this-page-does-not-exist' },
]
