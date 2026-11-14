/**
 * A confirmed transaction changes what the indexers will report a few
 * seconds later. Pages subscribe here (see RefreshAfterTransactions) so the
 * entry or list in view picks up the change without a reload.
 */
type Listener = () => void

const listeners = new Set<Listener>()

export const onTxConfirmed = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const emitTxConfirmed = (): void => {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch (err) {
      console.error('tx-confirmed listener failed', err)
    }
  })
}
