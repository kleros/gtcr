import {
  UserRejectedRequestError,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * wrapWithToast decides the outcome of every write the app sends: whether a
 * dialog closes, a page moves on, or the person may send again. These tests
 * drive it with a fake public client that answers each receipt wait in
 * turn, the way viem would.
 */

const mocks = vi.hoisted(() => {
  const toast = Object.assign(
    vi.fn(() => 'closed-then-new'),
    {
      info: vi.fn(() => 'tx'),
      success: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      isActive: vi.fn(() => true),
    },
  )
  return { toast, emitTxConfirmed: vi.fn() }
})
vi.mock('react-toastify', () => ({ toast: mocks.toast }))
vi.mock('./tx-events', () => ({ emitTxConfirmed: mocks.emitTxConfirmed }))

// Imported after the mocks above are in place.
const { isUserRejection, replacementOf, waitForOutcome, wrapWithToast } =
  await import('./wrap-with-toast')
type Client = import('./wrap-with-toast').TransactionReceiptClient
type Wait = Parameters<Client['waitForTransactionReceipt']>[0]

const SENT = `0x${'a'.repeat(64)}` as Hash
const OTHER = `0x${'b'.repeat(64)}` as Hash
const ACCOUNT = '0x1111111111111111111111111111111111111111'
const LIST = '0x2222222222222222222222222222222222222222'

const receipt = (
  hash: Hash,
  status: 'success' | 'reverted' = 'success',
  extra: Partial<TransactionReceipt> = {},
) =>
  ({
    transactionHash: hash,
    status,
    from: ACCOUNT,
    to: LIST,
    blockNumber: 10n,
    logs: [],
    ...extra,
  }) as unknown as TransactionReceipt

/** A public client whose receipt waits are answered by `steps`, in order. */
const fakeClient = (
  ...steps: ((wait: Wait) => Promise<TransactionReceipt>)[]
) => {
  const waits: Wait[] = []
  const client: Client & { waits: Wait[] } = {
    waits,
    chain: { id: 100 },
    waitForTransactionReceipt(wait) {
      waits.push(wait)
      const step = steps.shift()
      if (!step) return Promise.reject(new Error('no more receipt waits'))
      return step(wait)
    },
  }
  return client
}

const mined =
  (hash: Hash, status: 'success' | 'reverted' = 'success') =>
  () =>
    Promise.resolve(receipt(hash, status))
/**
 * A replaced transaction, as viem 2 answers it: the replacement's receipt,
 * with word of the replacement (onReplaced) only when one confirmation was
 * asked for (waitForTransactionReceipt, actions/public).
 */
const replacedBy =
  (reason: 'cancelled' | 'replaced' | 'repriced', hash: Hash = OTHER) =>
  (wait: Wait) => {
    if ((wait.confirmations ?? 1) <= 1)
      wait.onReplaced?.({ reason, transaction: { hash } })
    // A wallet's cancel is an empty transfer to oneself.
    return Promise.resolve(
      receipt(hash, 'success', reason === 'cancelled' ? { to: ACCOUNT } : {}),
    )
  }
const noReceipt = () =>
  Promise.reject(new Error('Timed out while waiting for transaction'))

const sent = () => Promise.resolve(SENT)

/** The last state written into the transaction's toast. */
const lastUpdate = () => mocks.toast.update.mock.calls.at(-1)?.[1]
/** Plain text of a toast message, with the explorer link's address. */
const textOf = (render: unknown): string => {
  if (typeof render === 'string') return render
  const element = render as { props?: { children?: unknown; href?: string } }
  const children = element?.props?.children
  const parts = Array.isArray(children) ? children : [children]
  return [
    ...parts.map((part) => (part === undefined ? '' : textOf(part))),
    element?.props?.href ?? '',
  ].join(' ')
}

beforeEach(() => {
  mocks.toast.mockClear()
  mocks.toast.update.mockClear()
  mocks.toast.info.mockClear()
  mocks.toast.isActive.mockReturnValue(true)
  mocks.emitTxConfirmed.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('wrapWithToast', () => {
  it('confirms after one block and then a second', async () => {
    const client = fakeClient(mined(SENT), mined(SENT))
    const result = await wrapWithToast(sent, client)

    expect(result).toMatchObject({ status: true })
    expect(result.result?.transactionHash).toBe(SENT)
    expect(client.waits.map((wait) => [wait.hash, wait.confirmations])).toEqual(
      [
        [SENT, 1],
        [SENT, 2],
      ],
    )
    expect(lastUpdate()).toMatchObject({ type: 'success', isLoading: false })
    expect(textOf(lastUpdate()?.render)).toContain('Transaction confirmed.')
    expect(mocks.emitTxConfirmed).toHaveBeenCalledTimes(1)
  })

  it('reports a revert at once, without waiting for a second block', async () => {
    const client = fakeClient(mined(SENT, 'reverted'))
    const result = await wrapWithToast(sent, client)

    expect(result.status).toBe(false)
    expect(result.result?.status).toBe('reverted')
    expect(result.pending).toBeUndefined()
    expect(result.replaced).toBeUndefined()
    expect(client.waits).toHaveLength(1)
    expect(lastUpdate()).toMatchObject({ type: 'error' })
    expect(mocks.emitTxConfirmed).not.toHaveBeenCalled()
  })

  it('closes quietly when the wallet owner declines', async () => {
    const client = fakeClient()
    const result = await wrapWithToast(
      () => Promise.reject(new UserRejectedRequestError(new Error('no'))),
      client,
    )

    expect(result).toEqual({ status: false })
    expect(client.waits).toHaveLength(0)
    expect(lastUpdate()).toMatchObject({
      render: 'Transaction cancelled in your wallet.',
      type: 'default',
    })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('shows any other failure before sending as an error', async () => {
    const result = await wrapWithToast(
      () => Promise.reject(new Error('The wallet is locked.')),
      fakeClient(),
    )

    expect(result).toEqual({ status: false })
    expect(lastUpdate()).toMatchObject({ type: 'error', autoClose: false })
    expect(console.error).toHaveBeenCalled()
  })

  it('reports a cancel from the wallet, never as confirmed', async () => {
    const client = fakeClient(replacedBy('cancelled'))
    const result = await wrapWithToast(sent, client)

    expect(result).toEqual({ status: false, replaced: true })
    expect(client.waits).toHaveLength(1)
    expect(textOf(lastUpdate()?.render)).toContain('cancelled in your wallet')
    expect(mocks.emitTxConfirmed).not.toHaveBeenCalled()
  })

  // Waiting for two confirmations at once, viem resolved with the
  // replacement's receipt without saying it was a different call, and this
  // read "Transaction confirmed.".
  it('reports a different transaction sent in its place as replaced', async () => {
    const client = fakeClient(replacedBy('replaced'))
    const result = await wrapWithToast(sent, client)

    expect(result).toEqual({ status: false, replaced: true })
    expect(textOf(lastUpdate()?.render)).toContain('replaced this transaction')
    expect(mocks.emitTxConfirmed).not.toHaveBeenCalled()
  })

  it('follows a speed-up under its new hash', async () => {
    const client = fakeClient(replacedBy('repriced'), mined(OTHER))
    const result = await wrapWithToast(sent, client)

    expect(result.status).toBe(true)
    expect(client.waits[1]).toMatchObject({ hash: OTHER, confirmations: 2 })
    expect(textOf(lastUpdate()?.render)).toContain(OTHER)
  })

  it('without a word from viem, takes an empty transfer to oneself for a cancel', async () => {
    const client = fakeClient(() =>
      Promise.resolve(receipt(OTHER, 'success', { to: ACCOUNT })),
    )
    const result = await wrapWithToast(sent, client)

    expect(result).toEqual({ status: false, replaced: true })
  })

  it('stays busy while a late receipt is followed, then reports it', async () => {
    let arrive!: (value: TransactionReceipt) => void
    const late = new Promise<TransactionReceipt>((resolve) => {
      arrive = resolve
    })
    const client = fakeClient(noReceipt, () => late)
    let settled = false
    const outcome = wrapWithToast(sent, client).then((result) => {
      settled = true
      return result
    })

    await vi.waitFor(() => expect(client.waits).toHaveLength(2))
    // Still following: a dialog that sent it must not offer to send again.
    expect(settled).toBe(false)
    expect(lastUpdate()).toMatchObject({ type: 'warning' })
    expect(textOf(lastUpdate()?.render)).toContain('Still waiting')
    expect(client.waits[1]).toMatchObject({
      hash: SENT,
      confirmations: 1,
      timeout: 15 * 60_000,
    })

    arrive(receipt(SENT))
    const result = await outcome
    expect(result.status).toBe(true)
    expect(lastUpdate()).toMatchObject({ type: 'success' })
    expect(mocks.emitTxConfirmed).toHaveBeenCalledTimes(1)
  })

  it('reads a receipt that never comes as pending, not failed', async () => {
    const result = await wrapWithToast(sent, fakeClient(noReceipt, noReceipt))

    expect(result).toEqual({ status: false, pending: true })
    // The warning stays: nothing claims the transaction failed.
    expect(lastUpdate()).toMatchObject({ type: 'warning' })
  })

  it('reports a late receipt that turns out replaced', async () => {
    const result = await wrapWithToast(
      sent,
      fakeClient(noReceipt, replacedBy('cancelled')),
    )

    expect(result).toEqual({ status: false, replaced: true })
  })

  it('follows a speed-up under its new hash when the second block is late', async () => {
    const client = fakeClient(replacedBy('repriced'), noReceipt, mined(OTHER))
    const result = await wrapWithToast(sent, client)

    expect(result.status).toBe(true)
    expect(client.waits[2]).toMatchObject({ hash: OTHER, confirmations: 1 })
  })

  it('still reports the outcome if the toast was closed meanwhile', async () => {
    mocks.toast.isActive.mockReturnValue(false)
    await wrapWithToast(sent, fakeClient(mined(SENT), mined(SENT)))

    expect(mocks.toast.update).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'success' }),
    )
  })

  // The list factories have a pending step of their own (Check again,
  // Deploy again): they take the late receipt at once, the toast follows on.
  it('returns a late receipt as pending at once when asked not to wait', async () => {
    let arrive!: (value: TransactionReceipt) => void
    const late = new Promise<TransactionReceipt>((resolve) => {
      arrive = resolve
    })
    const client = fakeClient(noReceipt, () => late)
    const result = await wrapWithToast(sent, client, { waitForLate: false })

    expect(result).toEqual({ status: false, pending: true })
    // Still followed: the toast turns into the outcome when it comes.
    arrive(receipt(SENT))
    await vi.waitFor(() =>
      expect(lastUpdate()).toMatchObject({ type: 'success' }),
    )
    expect(mocks.emitTxConfirmed).toHaveBeenCalledTimes(1)
  })

  it('names a speed-up’s hash to the page that sent it', async () => {
    const seen: Hash[] = []
    await wrapWithToast(
      sent,
      fakeClient(replacedBy('repriced'), mined(OTHER)),
      { onHash: (hash) => seen.push(hash) },
    )

    expect(seen).toEqual([OTHER])
  })
})

describe('waitForOutcome', () => {
  it('waits for one block only when asked for one', async () => {
    const client = fakeClient(mined(SENT))
    const { receipt: result } = await waitForOutcome(client, SENT, {
      confirmations: 1,
    })

    expect(result.transactionHash).toBe(SENT)
    expect(client.waits).toHaveLength(1)
  })

  it('names a speed-up’s hash before waiting for it', async () => {
    const seen: Hash[] = []
    const client = fakeClient(replacedBy('repriced'), mined(OTHER))
    await waitForOutcome(client, SENT, { onHash: (hash) => seen.push(hash) })

    expect(seen).toEqual([OTHER])
  })
})

describe('replacementOf', () => {
  it('finds no replacement in the sent transaction’s own receipt', () => {
    expect(
      replacementOf(receipt(SENT), SENT.toUpperCase() as Hash),
    ).toBeUndefined()
  })

  it('takes an empty transfer to oneself for a cancel', () => {
    expect(
      replacementOf(receipt(OTHER, 'success', { to: ACCOUNT }), SENT),
    ).toEqual({ reason: 'cancelled', transaction: { hash: OTHER } })
  })

  it('takes anything else for a speed-up', () => {
    expect(replacementOf(receipt(OTHER), SENT)?.reason).toBe('repriced')
    expect(
      replacementOf(receipt(OTHER, 'success', { to: null }), SENT)?.reason,
    ).toBe('repriced')
  })
})

describe('isUserRejection', () => {
  it('knows the wallet owner declining', () => {
    expect(isUserRejection({ code: 4001 })).toBe(true)
    expect(isUserRejection({ name: 'UserRejectedRequestError' })).toBe(true)
    expect(
      isUserRejection(new UserRejectedRequestError(new Error('declined'))),
    ).toBe(true)
    expect(
      isUserRejection({
        message: 'Request failed',
        cause: { message: 'MetaMask: User denied transaction signature.' },
      }),
    ).toBe(true)
  })

  it('leaves the failures of nodes and relays alone', () => {
    expect(isUserRejection(new Error('request rejected'))).toBe(false)
    expect(isUserRejection({ code: -32000, message: 'nonce too low' })).toBe(
      false,
    )
    expect(isUserRejection(undefined)).toBe(false)
  })

  it('stops on an error that is its own cause', () => {
    const looped: { message: string; cause?: unknown } = { message: 'loop' }
    looped.cause = looped
    expect(isUserRejection(looped)).toBe(false)
  })
})
