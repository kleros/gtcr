import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BigNumber, type ethers } from 'ethers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { LIST_SETTINGS_FAILED } from 'pages/error-page/copy'
import SubmitConnectModal from './submit-connect'

const tx = vi.hoisted(() => ({
  uploads: [] as unknown[],
  uploadFile: undefined as unknown as ReturnType<typeof vi.fn>,
  confirmStored: undefined as unknown as ReturnType<typeof vi.fn>,
  simulateContract: undefined as unknown as ReturnType<typeof vi.fn>,
  writeContract: undefined as unknown as ReturnType<typeof vi.fn>,
}))

const CONNECTED = '0xc0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0'
const PARENT = '0x1111111111111111111111111111111111111111'
const BADGE_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const BADGE_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

/** The lists' files, as useTcrMetaEvidence serves them. */
const LISTS = vi.hoisted(() => ({
  ['0xc0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0']: {
    fileURI: '/ipfs/policy.pdf',
    metadata: {
      tcrTitle: 'Badges',
      columns: [
        { label: 'Address', type: 'GTCR address' },
        { label: 'Match File URI', type: 'text' },
      ],
    },
  },
  ['0x1111111111111111111111111111111111111111']: {
    metadata: {
      columns: [
        { label: 'Name', isIdentifier: true },
        { label: 'Website', isIdentifier: true },
      ],
    },
  },
  ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']: {
    metadata: {
      columns: [
        { label: 'Token name', isIdentifier: true },
        { label: 'Logo', isIdentifier: false },
      ],
    },
  },
  ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']: {
    metadata: { columns: [{ label: 'Project', isIdentifier: true }] },
  },
}))

vi.mock('config/wagmi', () => ({ wagmiConfig: {}, appKitModal: null }))
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x9999999999999999999999999999999999999999' }),
  usePublicClient: () => ({}),
  useWalletClient: () => ({ data: { writeContract: tx.writeContract } }),
}))
vi.mock('@wagmi/core', () => ({
  simulateContract: (...args: unknown[]) => tx.simulateContract(...args),
}))
vi.mock('@kleros/kleros-app', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAtlasProvider: () => ({ uploadFile: tx.uploadFile }),
}))
vi.mock('utils/confirm-stored', () => ({
  confirmStored: (path: string) => tx.confirmStored(path),
}))
vi.mock('utils/wrap-with-toast', () => ({
  wrapWithToast: async (send: () => Promise<unknown>) => ({
    status: !!(await send()),
  }),
  errorToast: vi.fn(),
}))
vi.mock('hooks/native-currency', () => ({ default: () => 'xDAI' }))
vi.mock('hooks/use-tcr-meta-evidence', () => ({
  default: (address?: string) => {
    const data = address
      ? (LISTS[address.toLowerCase() as keyof typeof LISTS] ?? null)
      : undefined
    return {
      data,
      isError: false,
      isSuccess: data !== undefined,
      refetch: vi.fn(),
    }
  },
}))
// The wallet is connected, on the chain and signed in.
vi.mock('components/curate/item-standard-gate', () => ({
  useActionGate: () => ({ ready: true, controls: null }),
  gatedConfirm: (
    _gate: unknown,
    confirm: {
      label: string
      onConfirm: () => void
      disabled?: boolean
      blocker?: string
      loading?: boolean
    },
  ) => ({
    confirmLabel: confirm.label,
    onConfirm: confirm.onConfirm,
    confirmDisabled: confirm.disabled,
    confirmBlocker: confirm.blocker,
    loading: confirm.loading,
    showAmount: true,
  }),
}))

const ROUTE = `/tcr/100/${CONNECTED}`

const gtcrView = (
  fetchArbitrable = vi.fn(async () => ({
    submissionBaseDeposit: BigNumber.from('500000000000000000'),
    arbitrationCost: BigNumber.from('100000000000000000'),
    arbitrator: '0x0000000000000000000000000000000000000001',
  })),
) => ({ fetchArbitrable }) as unknown as ethers.Contract

const Modal = ({
  visible = true,
  view = gtcrView(),
}: {
  visible?: boolean
  view?: ethers.Contract
}) => (
  <SubmitConnectModal
    visible={visible}
    onCancel={() => undefined}
    tcrAddress={CONNECTED}
    gtcrView={view}
  />
)

const parentField = () =>
  screen.getByRole('textbox', { name: 'Parent list address' })
const badgeField = () =>
  screen.getByRole('textbox', { name: 'Badge list address' })
const confirm = () => screen.getByRole('button', { name: /^Enable badge/ })

/** The JSON files uploaded so far, in order: match file, then entry. */
const uploaded = () => tx.uploads as Array<Record<string, unknown>>

// Past the addresses' 300ms debounce and the reads after it, with room for a
// loaded runner.
const SETTLED = { timeout: 5_000 }

type User = ReturnType<typeof userEvent.setup>

/** An address pasted into a field, as one usually is. */
const paste = async (user: User, field: HTMLElement, text: string) => {
  await user.click(field)
  await user.paste(text)
}

const enterLists = async (user: User, badge: string) => {
  // The form shows once the list's deposit is read.
  await paste(
    user,
    await screen.findByRole('textbox', { name: 'Parent list address' }),
    PARENT,
  )
  await waitFor(() => expect(badgeField()).toBeEnabled(), SETTLED)
  await paste(user, badgeField(), badge)
}

const pick = async (user: User, badgeColumn: string, parentColumn: string) => {
  await user.click(
    await screen.findByRole('combobox', { name: badgeColumn }, SETTLED),
  )
  await user.click(screen.getByRole('option', { name: parentColumn }))
}

/** Waits for the deposit to have been sent this many times. */
const sent = (times: number) =>
  waitFor(() => expect(tx.writeContract).toHaveBeenCalledTimes(times), SETTLED)

/** A File's text (jsdom's File has no text()). */
const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })

beforeEach(() => {
  tx.uploads = []
  tx.uploadFile = vi.fn(async (file: File) => {
    tx.uploads.push(JSON.parse(await readText(file)))
    return `/ipfs/${tx.uploads.length}/${file.name}`
  })
  tx.confirmStored = vi.fn(async () => undefined)
  tx.simulateContract = vi.fn(async () => ({ request: { to: CONNECTED } }))
  tx.writeContract = vi.fn(async () => '0xhash')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Enable a badge', () => {
  it('sends the badge list it matched, with its own match file', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Modal />, { route: ROUTE })
    await enterLists(user, BADGE_A)
    await pick(user, 'Token name', 'Name')
    await user.click(confirm())

    await sent(1)
    expect(uploaded()[0]).toEqual({
      parentTCR: PARENT,
      connectedTCR: CONNECTED,
      badgeTCR: BADGE_A,
      columns: [0, null],
    })
    expect(uploaded()[1]).toMatchObject({
      values: { Address: BADGE_A, 'Match File URI': '/ipfs/1/match-file.json' },
    })
  })

  it('reads both files back before the deposit is paid', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Modal />, { route: ROUTE })
    await enterLists(user, BADGE_A)
    await pick(user, 'Token name', 'Name')
    await user.click(confirm())

    await sent(1)
    expect(tx.confirmStored.mock.calls.map(([path]) => path).sort()).toEqual([
      '/ipfs/1/match-file.json',
      '/ipfs/2/item.json',
    ])
    const lastRead = Math.max(...tx.confirmStored.mock.invocationCallOrder)
    expect(lastRead).toBeLessThan(
      tx.simulateContract.mock.invocationCallOrder[0],
    )
  })

  it('pays nothing when a file cannot be read back', async () => {
    tx.confirmStored = vi.fn(async () => {
      throw new Error('not readable')
    })
    // The dialog logs the failure it reports.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    renderWithProviders(<Modal />, { route: ROUTE })
    await enterLists(user, BADGE_A)
    await pick(user, 'Token name', 'Name')
    await user.click(confirm())

    await waitFor(() => expect(tx.confirmStored).toHaveBeenCalled(), SETTLED)
    await waitFor(() => expect(confirm()).toBeEnabled(), SETTLED)
    expect(tx.simulateContract).not.toHaveBeenCalled()
    expect(tx.writeContract).not.toHaveBeenCalled()
  })

  it('starts the matching over when the badge list changes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Modal />, { route: ROUTE })
    await enterLists(user, BADGE_A)
    await pick(user, 'Token name', 'Name')
    expect(confirm()).toBeEnabled()

    await user.clear(badgeField())
    await paste(user, badgeField(), BADGE_B)
    await screen.findByRole('combobox', { name: 'Project' }, SETTLED)
    expect(confirm()).toBeDisabled()

    await pick(user, 'Project', 'Website')
    await user.click(confirm())
    await sent(1)
    expect(uploaded()[0]).toMatchObject({ badgeTCR: BADGE_B, columns: [1] })
    expect(uploaded()[1]).toMatchObject({ values: { Address: BADGE_B } })
  })

  it('sends nothing for a badge address edited after the match', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Modal />, { route: ROUTE })
    await enterLists(user, BADGE_A)
    await pick(user, 'Token name', 'Name')

    // One more character: no longer an address, and not the list matched.
    await user.type(badgeField(), 'a')
    expect(confirm()).toBeDisabled()
    await user.click(confirm())
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(confirm()).toBeDisabled()
    expect(tx.uploadFile).not.toHaveBeenCalled()
    expect(tx.writeContract).not.toHaveBeenCalled()
  })

  it('opens empty after a badge is sent, with nothing of the last one', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(<Modal />, { route: ROUTE })
    await enterLists(user, BADGE_A)
    await pick(user, 'Token name', 'Name')
    await user.click(confirm())
    await sent(1)

    // The list page closes the dialog and keeps it mounted.
    rerender(<Modal visible={false} />)
    rerender(<Modal />)
    expect(parentField()).toHaveValue('')
    expect(badgeField()).toHaveValue('')

    await enterLists(user, BADGE_B)
    await screen.findByRole('combobox', { name: 'Project' }, SETTLED)
    expect(confirm()).toBeDisabled()
    await pick(user, 'Project', 'Website')
    await user.click(confirm())

    await sent(2)
    expect(uploaded()[2]).toEqual({
      parentTCR: PARENT,
      connectedTCR: CONNECTED,
      badgeTCR: BADGE_B,
      columns: [1],
    })
    expect(uploaded()[3]).toMatchObject({ values: { Address: BADGE_B } })
  })

  it("says when the list's deposit could not be read, and reads it again", async () => {
    const fetchArbitrable = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing response'))
      .mockResolvedValue({
        submissionBaseDeposit: BigNumber.from('500000000000000000'),
        arbitrationCost: BigNumber.from('100000000000000000'),
        arbitrator: '0x0000000000000000000000000000000000000001',
      })
    const user = userEvent.setup()
    renderWithProviders(<Modal view={gtcrView(fetchArbitrable)} />, {
      route: ROUTE,
    })

    expect(await screen.findByRole('alert', {}, SETTLED)).toHaveTextContent(
      LIST_SETTINGS_FAILED,
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole(
        'textbox',
        { name: 'Parent list address' },
        SETTLED,
      ),
    ).toBeInTheDocument()
  })
})
