import { ItemTypes } from '@kleros/gtcr-encoder'
import { NETWORKS } from 'config/networks'

/*
 * The wizard defaults for a Stake Curate list. Every pre-filled value and
 * every placeholder in the steps reads from here, so a hint can never
 * contradict the stored state. The launch page mirrors these numbers.
 */

export const WIZARD_DEFAULTS = {
  submissionMinDeposit: 0.05,
  submissionPeriodDuration: 84,
  reinclusionPeriodDuration: 12,
  withdrawingPeriodDuration: 84,
  arbitrationParamsCooldown: 168,
  itemName: 'item',
  itemNamePlural: 'items',
  challengeStakeMultiplier: 50,
  sharedStakeMultiplier: 100,
  winnerStakeMultiplier: 100,
  loserStakeMultiplier: 200,
} as const

/** The first field of a new list: an address that identifies the entry. */
export const DEFAULT_COLUMN: Column = {
  label: '',
  description: '',
  type: ItemTypes.ADDRESS,
  isIdentifier: true,
}

/** A field added with "Add field": same shape, not an identifier yet. */
export const NEW_COLUMN: Column = {
  label: '',
  description: '',
  type: ItemTypes.ADDRESS,
}

/**
 * The ERC-20 the wizard pre-fills as the stake token, per chain. A chain
 * without an entry starts with an empty token address and the list step
 * asks for one. (Belongs in config/tcr-addresses.ts next to defaultArbitrator;
 * it lives here because the factory unit may not edit shared config.)
 */
export const defaultStakeToken: Readonly<
  Record<number, { address: string; label: string } | undefined>
> = {
  [NETWORKS.gnosis]: {
    address: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    label: 'sDAI',
  },
}

/** Bounds of the simple-mode stake slider (a control range, not a default). */
export const STAKE_SLIDER = { min: 0, max: 30, step: 0.01 } as const

/** Jurors in the first round: odd numbers from 1 to 33. */
export const JURORS = { min: 1, max: 33, step: 2 } as const

export const LOGO_TYPES = new Set([
  'image/png',
  'image/svg+xml',
  'image/webp',
  'image/jpeg',
])
export const LOGO_MAX_MB = 2
export const POLICY_TYPE = 'application/pdf'
export const POLICY_MAX_MB = 4

export const EXAMPLE_POLICY_URL =
  'https://cdn.kleros.link/ipfs/QmUPsjDcKxNv6z6ktnmxkSb4LpqmQ7DT12yG5B73z9uLEy/curated-lists-primary-document.pdf'
