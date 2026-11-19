/*
 * The Stake entry page's and the Stake history's person address. It used to
 * be its own explorer link with an always-visible copy button, which made a
 * Stake entry behave unlike a Standard one. It is now the app's one control
 * for a person, CuratorAddress: it opens their Curate profile, and copy
 * keeps its room and fades in on hover or focus (always shown on touch
 * screens), so the words after it, such as " · case 898", never move. The
 * name and props are kept so the entry page and the timeline switched over
 * unchanged. It is for people only; a contract is a ChromeAddress.
 */
export { CuratorAddress as AddressLink } from './chrome-address'
