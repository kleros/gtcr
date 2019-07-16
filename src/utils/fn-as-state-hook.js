import { useState } from 'react'

/**
 * Sets a function as state. Useful to get around https://github.com/facebook/react/issues/14087
 * @param {function} fn - The new function to be stored in state.
 * @returns {Array} - The current function and a setter respectively.
 */
export default function useFunctionAsState(fn) {
  const [val, setVal] = useState(() => fn)
  const setFunc = fn => {
    setVal(() => fn)
  }
  return [val, setFunc]
}
