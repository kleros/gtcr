export const ITEMS_PER_PAGE = 40

export const ORDER_DIR = Object.freeze({
  asc: 'asc',
  desc: 'desc'
})

export const FILTER_STATUS = Object.freeze({
  absent: 'Absent',
  registered: 'Registered',
  submitted: 'RegistrationRequested',
  removalRequested: 'ClearingRequested',
  challengedSubmissions: 'RegistrationRequested',
  challengedRemovals: 'ClearingRequested'
})

export const DEFAULT_FILTER_VALUES = Object.freeze({
  page: 1,
  oldestFirst: false,
  absent: false,
  registered: false,
  submitted: false,
  removalRequested: false,
  challengedSubmissions: false,
  challengedRemovals: false
})
