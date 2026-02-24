// React Query cache settings — mirrors kleros/kleros-v2 web pattern.
// See: https://github.com/kleros/kleros-v2/blob/master/web/src/consts/index.ts

/** Polling interval for actively-changing data (disputes, item status). */
export const REFETCH_INTERVAL = 5000

/** Duration (ms) before data is considered stale enough to refetch. */
export const STALE_TIME = 1000
