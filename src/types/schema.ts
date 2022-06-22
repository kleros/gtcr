import { BigNumber } from 'ethers/utils'

export type MetaEvidence = {
  id: string
  timestamp: string
  URI: string
  metadata: Metadata
}

export type Metadata = {
  isTCRofTCRs: boolean
  itemName: string
  itemNamePlural: string
  logoURI: string
  relTcrDisabled: boolean
  requireRemovalEvidence: boolean
  tcrDescription: string
  tcrTitle: string
  columns: Array<MetadataColumn>
}

export type MetadataColumn = {
  type: string
  lable: string
  description: string
  isIdentifier: boolean
}

export type LItem = {
  ID: string
  itemID: string
  data: string
  status: number
  decodedData: Array<string>
  mergedData: Array<LItemProp>
  columns: Array<LItemProp>
  requests: Array<LRequest>
  latestRequest: LRequest
  latestRound: LRound
  disputeStatus: DisputeStatus
  disputed: boolean
  disputeID: string
  submissionTime: BigNumber
  hasPaid: [boolean, boolean, boolean]
  currentRuling: RulingCode
  appealCost: BigNumber
  appealStart: BigNumber
  appealEnd: BigNumber
  amountPaid: [string, string, string]
  errors: Array<Error>
}

export type LItemProp = MetadataColumn & {
  value: string
}

export type LRequest = {
  rounds: Array<LRound>
  disputed: boolean
  disputeID: string
  submissionTime: string
}

export type LRound = {
  appealCost: string
  appealPeriodStart: string
  appealPeriodEnd: string
  ruling: string
  hasPaidRequester: boolean
  hasPaidChallenger: boolean
  amountPaidRequester: string
  amountPaidChallenger: string
  disputeStatus: DisputeStatus
}

export type LRegistry = {
  id: string
  connectedTCR: string
  submissionDeposit: string
  submissionBaseDeposit: string
  submissionChallengeDeposit: string
  removalDeposit: string
  removalBaseDeposit: string
  removalChallengeDeposit: string
  arbitrationCost: string
  challengePeriodDuration: string
  numberOfAbsent: string
  numberOfRegistered: string
  numberOfRegistrationRequested: string
  numberOfClearingRequested: string
  numberOfChallengedRegistrations: string
  numberOfChallengedClearing: string
  sharedStakeMultiplier: string
  winnerStakeMultiplier: string
  loserStakeMultiplier: string
  MULTIPLIER_DIVISOR: string
}

export enum RulingCode {
  none = 0,
  accept = 1,
  reject = 2
}

export enum DisputeStatus {}

export enum OrderDir {
  asc,
  desc
}
