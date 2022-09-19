import { useMemo } from 'react'

// once upon a time, infura was giving timeout errors.
// alchemy was used as a result. but users tend to use
// metamask, which defaults to infura as rpc provider,
// and thus these errors kept happening.
// the solution then was to override the library used to
// fetch the logs, and use the once provided in the env.

// alchemy is now giving 429 errors a bit too frequently,
// and infura somehow works seamlessly again, so this function
// doesn't seem to do anything anymore. but, it's there in case
// these overrides come useful again. plus, refactoring it out
// would be time consuming.
const useGetLogs = library => {
  const getLogs = useMemo(
    () => async query => {
      const defResult = await library.getLogs(query)
      return defResult
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, library.network]
  )
  if (!library || !library.network) return null
  return getLogs
}

export default useGetLogs
