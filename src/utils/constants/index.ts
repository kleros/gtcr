export const ITEMS_PER_PAGE = 40

export const ORDER_DIR = Object.freeze({
  asc: 'asc',
  desc: 'desc'
})

export const FILTER_STAUTS = Object.freeze({
  absent: 'Absent',
  registered: 'Registered',
  submitted: 'RegistrationRequested',
  removalRequested: 'ClearingRequested',
  challengedSubmissions: 'RegistrationRequested',
  challengedRemovals: 'ClearingRequested'
})
