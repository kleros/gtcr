export const ITEM_STATUS_CODES: {
  [key: string]: number
} = Object.freeze({
  Absent: 0,
  Registered: 1,
  RegistrationRequested: 2,
  ClearingRequested: 3
})

export const RULING_CODES: {
  [key: string]: number
} = Object.freeze({
  None: 0,
  Accept: 1,
  Reject: 2
})
