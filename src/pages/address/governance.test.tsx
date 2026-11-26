import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zeroAddress } from 'viem'
import { renderWithProviders } from 'test/render'

/*
 * The governance dialog end to end, with the wallet, the chain reads, the
 * indexer and Atlas stood in for: nothing leaves without its review, a
 * double-click cannot confirm one, a transfer to a list is refused, a
 * proposal is not queued twice, an untouched file goes back as the list
 * holds it, the two files must name one policy, and a new policy PDF is
 * written into both files with nothing else changed.
 */

// jsdom's Blob has no text(), which browsers have and the app reads JSON
// files with (utils/upload-once).
if (!('text' in Blob.prototype))
  Object.defineProperty(Blob.prototype, 'text', {
    value(this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener('load', () => resolve(String(reader.result)))
        reader.addEventListener('error', () => reject(reader.error))
        reader.readAsText(this)
      })
    },
  })

const h = vi.hoisted(() => ({
  account: undefined as string | undefined,
  code: {} as Record<string, string>,
  // What a view returns, by "address:function" (lowercase).
  views: {} as Record<string, unknown>,
  stake: { count: 1, arbitratorExtraData: '0x' },
  indexer: undefined as unknown,
  stakeIndexer: undefined as unknown,
  files: {} as Record<string, unknown>,
  writes: [] as { functionName: string; args: unknown[] }[],
  uploads: [] as { name: string; text: string }[],
  toasts: [] as string[],
  // While set, chain reads wait for it: the moment between a click and
  // the read it starts.
  hold: undefined as Promise<void> | undefined,
}))

vi.mock('config/wagmi', () => ({
  wagmiConfig: {},
  appKitModal: undefined,
}))
vi.mock('config/tcr-addresses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('config/tcr-addresses')>()),
  subgraphUrl: { 100: 'https://indexer.test' },
  subgraphUrlPermanent: { 100: 'https://stake-indexer.test' },
}))
vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useAccount: () => ({
    address: h.account,
    chainId: 100,
    isConnected: !!h.account,
  }),
  useReadContract: () => ({ data: 18 }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
  useWalletClient: () => ({
    data: h.account
      ? {
          account: { address: h.account },
          writeContract: async (request: {
            functionName: string
            args: unknown[]
          }) => {
            h.writes.push(request)
            return `0x${'ab'.repeat(32)}`
          },
        }
      : undefined,
    isError: false,
    refetch: vi.fn(),
  }),
}))
const view = (address: string, functionName: string) =>
  h.views[`${address.toLowerCase()}:${functionName}`]
vi.mock('@wagmi/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@wagmi/core')>()),
  getPublicClient: () => ({
    getCode: async ({ address }: { address: string }) =>
      h.code[address.toLowerCase()] ?? '0x',
  }),
  readContracts: async (
    _config: unknown,
    {
      allowFailure,
      contracts,
    }: {
      allowFailure?: boolean
      contracts: { address: string; functionName: string }[]
    },
  ) => {
    await h.hold
    return contracts.map(({ address, functionName }) => {
      const value = view(address, functionName)
      if (allowFailure === false) return value
      return value === undefined
        ? { status: 'failure', error: new Error('reverted') }
        : { status: 'success', result: value }
    })
  },
  readContract: async (
    _config: unknown,
    { address, functionName }: { address: string; functionName: string },
  ) => {
    const value = view(address, functionName)
    if (value === undefined) throw new Error('reverted')
    return value
  },
  simulateContract: async (_config: unknown, call: unknown) => ({
    request: call,
  }),
}))
vi.mock('@kleros/kleros-app', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kleros/kleros-app')>()),
  useAtlasProvider: () => ({
    // Atlas as an IPFS: a path per upload, the file served from then on.
    uploadFile: async (file: File) => {
      const text = await file.text()
      const path = `/ipfs/QmUpload${h.uploads.length}/${file.name}`
      h.uploads.push({ name: file.name, text })
      h.files[path] =
        file.type === 'application/json' ? JSON.parse(text) : 'pdf'
      return path
    },
    isVerified: true,
    isSigningIn: false,
    authoriseUser: vi.fn(),
    roleRestrictions: undefined,
  }),
}))
vi.mock('hooks/ethers-adapters', () => ({ useEthersProvider: () => undefined }))
vi.mock('hooks/use-court-policies', () => ({
  default: () => ({
    data: [
      { courtID: 1, value: '1', label: 'General Court', feeForJuror: '0' },
      { courtID: 2, value: '2', label: 'Curation', feeForJuror: '0' },
    ],
  }),
}))
vi.mock('utils/indexer-request', () => ({
  request: async ({ document }: { document: string }) =>
    document.includes('GovernanceStakeSetting') ? h.stakeIndexer : h.indexer,
}))
vi.mock('utils/stake-arbitration-params', () => ({
  readStakeArbitrationParams: async () => h.stake,
}))
vi.mock('utils/wrap-with-toast', async (importOriginal) => {
  const real = await importOriginal<typeof import('utils/wrap-with-toast')>()
  const note = (message: string) => {
    h.toasts.push(message)
  }
  return {
    ...real,
    errorToast: note,
    infoToast: note,
    successToast: note,
    wrapWithToast: async (write: () => Promise<string>) => {
      await write()
      return { status: true }
    },
  }
})

// eslint-disable-next-line import/first
import { ListGovernanceDialog } from './governance'

const KLEROS = '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002'
const LIST = '0x1111111111111111111111111111111111111111'
const ME = '0x2222222222222222222222222222222222222222'
const SAFE = '0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe'
const OTHER_LIST = '0x3333333333333333333333333333333333333333'
const word = (n: number) => n.toString(16).padStart(64, '0')
const extra = (court: number, jurors: number) =>
  `0x${word(court)}${word(jurors)}`

const REG = '/ipfs/QmReg/reg-meta-evidence.json'
const CLR = '/ipfs/QmClr/clr-meta-evidence.json'
const POLICY = '/ipfs/QmPolicy/policy.pdf'
const columns = [{ label: 'Address', type: 'address' }]
const registrationFile = (fileURI: string) => ({
  title: 'Add a token to Tokens',
  fileURI,
  metadata: { tcrTitle: 'Tokens', columns },
  rulingOptions: { titles: ['Yes, Add It', "No, Don't Add It"] },
})
const clearingFile = (fileURI: string) => ({
  title: 'Remove a token from Tokens',
  fileURI,
  metadata: { tcrTitle: 'Tokens', columns },
  rulingOptions: { titles: ['Yes, Remove It', "No, Don't Remove It"] },
})

beforeEach(() => {
  Object.assign(h, {
    account: ME,
    code: { [LIST]: '0x6080', [SAFE]: '0x6080', [OTHER_LIST]: '0x6080' },
    views: {
      [`${LIST}:arbitrator`]: KLEROS,
      [`${LIST}:arbitratorExtraData`]: extra(1, 3),
      [`${LIST}:metaEvidenceUpdates`]: 1n,
      [`${SAFE}:getThreshold`]: 2n,
      [`${SAFE}:getOwners`]: [ME, OTHER_LIST, LIST, SAFE],
      [`${OTHER_LIST}:governor`]: ME,
      [`${OTHER_LIST}:arbitrator`]: KLEROS,
      [`${LIST}:arbitrationParamsCooldown`]: 604_800n,
    },
    indexer: {
      registry: {
        registrationMetaEvidence: { uri: REG },
        clearingMetaEvidence: { uri: CLR },
        connectedTCR: null,
        metaEvidenceCount: 2,
      },
    },
    files: {
      [REG]: registrationFile(POLICY),
      [CLR]: clearingFile(POLICY),
      [POLICY]: 'pdf',
    },
    writes: [],
    uploads: [],
    toasts: [],
    hold: undefined,
  })
  vi.stubGlobal('fetch', async (url: string) => {
    const path = Object.keys(h.files).find((key) =>
      String(url).endsWith(key.trim()),
    )
    return path
      ? new Response(JSON.stringify(h.files[path]), { status: 200 })
      : new Response('not found', { status: 404 })
  })
})

const standardList = (overrides: Record<string, string> = {}) => ({
  id: `standard-100-${LIST}`,
  address: LIST,
  chainId: 100,
  kind: 'standard' as const,
  title: 'Tokens',
  itemCount: 0,
  activeCount: 0,
  pendingCount: 0,
  disputeCount: 0,
  trustStatus: 'unknown' as const,
  governor: (overrides.governor ?? ME).toLowerCase(),
  params: {
    governor: ME,
    arbitrator: KLEROS,
    arbitratorExtraData: extra(1, 3),
    submissionBaseDeposit: '500000000000000000',
    removalBaseDeposit: '500000000000000000',
    submissionChallengeBaseDeposit: '0',
    removalChallengeBaseDeposit: '0',
    challengePeriodDuration: '302400',
    winnerStakeMultiplier: '10000',
    loserStakeMultiplier: '20000',
    sharedStakeMultiplier: '10000',
    relayerContract: zeroAddress,
    metaEvidenceUpdates: '1',
    ...overrides,
  },
})

const open = (registry: ReturnType<typeof standardList>) =>
  renderWithProviders(
    <ListGovernanceDialog registry={registry as never} onClose={() => {}} />,
  )

/** The field an input sits in: its review opens there too. */
const fieldOf = (input: HTMLElement) =>
  input.closest('div')!.parentElement!.parentElement! as HTMLElement

/** Past the moment a double-click's second click would land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 450))

const showSection = (name: string) =>
  userEvent.click(screen.getByRole('radio', { name }))

describe('a change is reviewed before anything leaves', () => {
  it('shows the deposit before and after, sends nothing on Back, and sends once from the review', async () => {
    open(standardList())
    await showSection('Deposits')
    const input = screen.getByRole('textbox', {
      name: 'Submission deposit (xDAI)',
    })
    await userEvent.clear(input)
    await userEvent.type(input, '1')
    const field = fieldOf(input)
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const review = await within(field).findByRole('region')
    expect(review).toHaveTextContent('0.5 xDAI')
    expect(review).toHaveTextContent('1 xDAI')
    expect(review).toHaveTextContent('1,000,000,000,000,000,000 wei')
    expect(review).toHaveTextContent(/made from now on/)
    expect(h.writes).toHaveLength(0)

    await userEvent.click(within(review).getByRole('button', { name: 'Back' }))
    expect(within(field).queryByRole('region')).toBeNull()
    expect(h.writes).toHaveLength(0)

    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const again = await within(field).findByRole('region')
    await settle()
    // The second click of a double-click is dropped.
    fireEvent.click(
      within(again).getByRole('button', { name: 'Sign in wallet' }),
      {
        detail: 2,
      },
    )
    expect(h.writes).toHaveLength(0)
    await userEvent.click(
      within(again).getByRole('button', { name: 'Sign in wallet' }),
    )
    await waitFor(() => expect(h.writes).toHaveLength(1))
    expect(h.writes[0]).toMatchObject({
      functionName: 'changeSubmissionBaseDeposit',
      args: [1_000_000_000_000_000_000n],
    })
  })
})

describe('a governor transfer', () => {
  it('is refused to a list, and reviewed with the threshold for a Safe', async () => {
    open(standardList())
    await showSection('Advanced')
    const input = screen.getByRole('textbox', { name: 'Governor address' })
    const field = fieldOf(input)
    await userEvent.clear(input)
    await userEvent.type(input, OTHER_LIST)
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    expect(
      await within(field).findByText(/a list never sends transactions/),
    ).toBeInTheDocument()
    expect(within(field).queryByRole('region')).toBeNull()

    await userEvent.clear(input)
    await userEvent.type(input, SAFE)
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const review = await within(field).findByRole('region')
    expect(review).toHaveTextContent(
      'A Safe on Gnosis: 2 of its 4 owners sign each change.',
    )
    expect(
      within(review).getByRole('button', { name: 'Sign the transfer' }),
    ).toBeInTheDocument()
  })
})

describe('a Safe connected as the wallet', () => {
  it('proposes a change once: the same one cannot be proposed again', async () => {
    h.account = SAFE
    open(standardList({ governor: SAFE }))
    await showSection('Deposits')
    const input = screen.getByRole('textbox', {
      name: 'Submission deposit (xDAI)',
    })
    await userEvent.clear(input)
    await userEvent.type(input, '2')
    const field = fieldOf(input)
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const review = await within(field).findByRole('region')
    await settle()
    await userEvent.click(
      within(review).getByRole('button', { name: 'Propose to the Safe' }),
    )
    await waitFor(() => expect(h.writes).toHaveLength(1))
    const button = within(field).getByRole('button', { name: 'Review change' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(within(field).queryByRole('region')).toBeNull()
    expect(h.writes).toHaveLength(1)
  })
})

describe('the court and its MetaEvidence', () => {
  /** The court field, once its files are the live ones. */
  const courtField = async () => {
    await screen.findByDisplayValue(REG)
    return fieldOf(screen.getByRole('textbox', { name: 'Arbitrator address' }))
  }

  it('sends a file left alone back exactly as the list holds it', async () => {
    const spaced = ` ${CLR}`
    ;(h.indexer as any).registry.clearingMetaEvidence.uri = spaced
    open(standardList())
    const field = await courtField()
    const jurors = within(field).getByRole('textbox', {
      name: 'Number of jurors',
    })
    await userEvent.clear(jurors)
    await userEvent.type(jurors, '5')
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const review = await within(field).findByRole('region')
    expect(review).toHaveTextContent('General Court · ID 1 · 5 jurors')
    await settle()
    await userEvent.click(
      within(review).getByRole('button', { name: 'Sign in wallet' }),
    )
    await waitFor(() => expect(h.writes).toHaveLength(1))
    expect(h.writes[0].args).toEqual([KLEROS, extra(1, 5), REG, spaced])
  })

  it('refuses files that name two different policies', async () => {
    const other = '/ipfs/QmReg2/reg-meta-evidence.json'
    h.files[other] = registrationFile('/ipfs/QmPolicy2/policy.pdf')
    h.files['/ipfs/QmPolicy2/policy.pdf'] = 'pdf'
    open(standardList())
    const field = await courtField()
    const registration = screen.getByDisplayValue(REG)
    await userEvent.clear(registration)
    await userEvent.type(registration, other)
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    await waitFor(() =>
      expect(h.toasts.join('\n')).toMatch(/name different policies/),
    )
    expect(within(field).queryByRole('region')).toBeNull()
    expect(h.writes).toHaveLength(0)
  })

  it('writes a new policy PDF into both files, nothing else changed, and reviews it', async () => {
    open(standardList())
    await screen.findByDisplayValue(REG)
    const pdf = new File(['%PDF-1.4'], 'policy.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(screen.getByLabelText('Policy (PDF)'), pdf)
    await waitFor(() =>
      expect(h.toasts.join('\n')).toMatch(/new policy is in the two/),
    )
    const [newPolicy, newRegistration, newClearing] = [0, 1, 2].map(
      (index) => `/ipfs/QmUpload${index}/${h.uploads[index].name}`,
    )
    expect(JSON.parse(h.uploads[1].text)).toEqual({
      ...registrationFile(POLICY),
      fileURI: newPolicy,
    })
    expect(JSON.parse(h.uploads[2].text)).toEqual({
      ...clearingFile(POLICY),
      fileURI: newPolicy,
    })
    expect(screen.getByDisplayValue(newRegistration)).toBeInTheDocument()
    expect(screen.getByDisplayValue(newClearing)).toBeInTheDocument()

    const field = fieldOf(
      screen.getByRole('textbox', { name: 'Arbitrator address' }),
    )
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const review = await within(field).findByRole('region')
    expect(review).toHaveTextContent(newPolicy)
    expect(review).toHaveTextContent(/Requests made from then on/)
    await settle()
    await userEvent.click(
      within(review).getByRole('button', { name: 'Sign in wallet' }),
    )
    await waitFor(() => expect(h.writes).toHaveLength(1))
    expect(h.writes[0].args).toEqual([
      KLEROS,
      extra(1, 3),
      newRegistration,
      newClearing,
    ])
  })
})

describe('a change whose settings moved while its review was open', () => {
  const courtField = async () => {
    await screen.findByDisplayValue(REG)
    return fieldOf(screen.getByRole('textbox', { name: 'Arbitrator address' }))
  }
  /** The court field's review of 5 jurors, opened and settled. */
  const reviewFiveJurors = async () => {
    const field = await courtField()
    const jurors = within(field).getByRole('textbox', {
      name: 'Number of jurors',
    })
    await userEvent.clear(jurors)
    await userEvent.type(jurors, '5')
    await userEvent.click(
      within(field).getByRole('button', { name: 'Review change' }),
    )
    const review = await within(field).findByRole('region')
    await settle()
    return { field, jurors, review }
  }
  /** Another change lands: one more settings entry, on another court. */
  const changedElsewhere = () => {
    h.views[`${LIST}:metaEvidenceUpdates`] = 2n
    h.views[`${LIST}:arbitratorExtraData`] = extra(2, 3)
    ;(h.indexer as any).registry.metaEvidenceCount = 4
  }

  it('sends nothing, and the form starts again from the live settings', async () => {
    open(standardList())
    const { jurors, review } = await reviewFiveJurors()
    changedElsewhere()
    await userEvent.click(
      within(review).getByRole('button', { name: 'Sign in wallet' }),
    )
    await waitFor(() =>
      expect(h.toasts.join('\n')).toMatch(
        /settings changed since this dialog opened, so nothing was sent/,
      ),
    )
    expect(h.writes).toHaveLength(0)
    // The live settings, read again: court 2, its 3 jurors.
    await waitFor(() => expect(jurors).toHaveValue('3'))
  })

  it('sends it when nothing moved', async () => {
    open(standardList())
    const { review } = await reviewFiveJurors()
    await userEvent.click(
      within(review).getByRole('button', { name: 'Sign in wallet' }),
    )
    await waitFor(() => expect(h.writes).toHaveLength(1))
  })

  describe('exported for a Safe', () => {
    let copied: string[]
    beforeEach(() => {
      copied = []
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            copied.push(text)
          },
        },
      })
    })

    it('copies no calldata', async () => {
      open(standardList({ governor: SAFE }))
      const { review } = await reviewFiveJurors()
      changedElsewhere()
      await userEvent.click(
        within(review).getByRole('button', { name: 'Copy calldata' }),
      )
      await waitFor(() =>
        expect(h.toasts.join('\n')).toMatch(/settings changed since/),
      )
      expect(copied).toEqual([])
    })

    it('copies the calldata when nothing moved (no ClipboardItem)', async () => {
      open(standardList({ governor: SAFE }))
      const { review } = await reviewFiveJurors()
      await userEvent.click(
        within(review).getByRole('button', { name: 'Copy calldata' }),
      )
      await waitFor(() => expect(copied).toHaveLength(1))
      expect(copied[0]).toMatch(new RegExp(`^to: ${LIST}\nvalue: 0\ndata: 0x`))
    })

    it('downloads no file', async () => {
      // jsdom has no object URLs: the download's first step, counted.
      const download = vi.fn(() => 'blob:test')
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: download,
      })
      open(standardList({ governor: SAFE }))
      const { review } = await reviewFiveJurors()
      changedElsewhere()
      await userEvent.click(
        within(review).getByRole('button', { name: 'Download Safe file' }),
      )
      await waitFor(() =>
        expect(h.toasts.join('\n')).toMatch(/settings changed since/),
      )
      expect(download).not.toHaveBeenCalled()
    })

    it('copies once the settings are read again, keeping the click (ClipboardItem)', async () => {
      const items: { 'text/plain': Promise<Blob> }[] = []
      // As a browser does: the write ends once the item's text is there.
      const write = vi.fn(async ([item]: { items: any }[]) => {
        items.push(item.items)
        await item.items['text/plain']
      })
      vi.stubGlobal(
        'ClipboardItem',
        class {
          constructor(public items: unknown) {}
        },
      )
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { write },
      })
      try {
        open(standardList({ governor: SAFE }))
        const { review } = await reviewFiveJurors()
        let release = () => {}
        h.hold = new Promise<void>((resolve) => {
          release = resolve
        })
        await userEvent.click(
          within(review).getByRole('button', { name: 'Copy calldata' }),
        )
        // Written on the click, while the settings are still being read.
        await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
        expect(h.toasts.join('\n')).not.toMatch(/Calldata copied/)
        release()
        const text = await (await items[0]['text/plain']).text()
        expect(text).toMatch(new RegExp(`^to: ${LIST}\nvalue: 0\ndata: 0x`))
        await waitFor(() =>
          expect(h.toasts.join('\n')).toMatch(/Calldata copied/),
        )
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })
})

describe("a new policy and files of the governor's own", () => {
  it('is written into their file, not over it, and Remove gives it back', async () => {
    const own = '/ipfs/QmOwn/reg-meta-evidence.json'
    const ownFile = {
      ...registrationFile(POLICY),
      metadata: {
        tcrTitle: 'Tokens',
        columns: [...columns, { label: 'Website', type: 'link' }],
      },
    }
    h.files[own] = ownFile
    open(standardList())
    const registration = await screen.findByDisplayValue(REG)
    await userEvent.clear(registration)
    await userEvent.type(registration, own)
    await userEvent.upload(
      screen.getByLabelText('Policy (PDF)'),
      new File(['%PDF-1.4'], 'policy.pdf', { type: 'application/pdf' }),
    )
    await waitFor(() =>
      expect(h.toasts.join('\n')).toMatch(/new policy is in the two/),
    )
    const newPolicy = `/ipfs/QmUpload0/${h.uploads[0].name}`
    expect(JSON.parse(h.uploads[1].text)).toEqual({
      ...ownFile,
      fileURI: newPolicy,
    })
    expect(JSON.parse(h.uploads[2].text)).toEqual({
      ...clearingFile(POLICY),
      fileURI: newPolicy,
    })

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByDisplayValue(own)).toBeInTheDocument()
    expect(screen.getByDisplayValue(CLR)).toBeInTheDocument()
  })

  it('names their file when it cannot be read', async () => {
    const own = '/ipfs/QmMissing/reg-meta-evidence.json'
    open(standardList())
    const registration = await screen.findByDisplayValue(REG)
    await userEvent.clear(registration)
    await userEvent.type(registration, own)
    await userEvent.upload(
      screen.getByLabelText('Policy (PDF)'),
      new File(['%PDF-1.4'], 'policy.pdf', { type: 'application/pdf' }),
    )
    await waitFor(() =>
      expect(h.toasts.join('\n')).toMatch(
        /registration MetaEvidence file in its field could not be read/,
      ),
    )
    expect(screen.getByDisplayValue(own)).toBeInTheDocument()
  })
})

describe('a list on another arbitrator', () => {
  it('is not shown Kleros courts or fees', async () => {
    const other = '0x4444444444444444444444444444444444444444'
    h.views[`${LIST}:arbitrator`] = other
    open(standardList({ arbitrator: other }))
    expect(
      await screen.findByText(/is not Kleros Court on Gnosis/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Court' })).toBeNull()
  })
})
