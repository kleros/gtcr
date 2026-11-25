import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import SubmitItem from '.'

/*
 * The Stake submit page reads its fields from the list's MetaEvidence file,
 * which whoever deploys the list writes. The chain, the wallet and the
 * indexer are stood in for; the file comes from a stubbed fetch.
 */

const LIST = '0x43782f0daebce6ef46ce6250a6296e8af99227eb'
const FILE_URI = '/ipfs/QmStakeListFile/meta.json'

const { registry } = vi.hoisted(() => ({
  registry: {
    id: '0x43782f0daebce6ef46ce6250a6296e8af99227eb',
    token: '0x0000000000000000000000000000000000000001',
    submissionMinDeposit: '1000000000000000000',
    challengeStakeMultiplier: '5000',
    submissionPeriod: '86400',
    withdrawingPeriod: '86400',
    arbitrator: { id: '0x0000000000000000000000000000000000000002' },
    arbitrationSettings: [
      {
        metaEvidenceURI: '/ipfs/QmStakeListFile/meta.json',
        arbitratorExtraData: '0x',
        metadata: {
          title: 'Stake tags',
          itemName: 'tag',
          policyURI: '/ipfs/QmPolicy/policy.pdf',
        },
      },
    ],
  },
}))

vi.mock('hooks/use-check-standard-curate', () => ({
  default: () => ({
    isStandardCurate: false,
    isClassicCurate: false,
    isPermanentCurate: true,
    checking: false,
    error: undefined,
    retry: () => {},
    recheck: () => {},
  }),
}))
vi.mock('hooks/use-tcr-network', () => ({ default: () => undefined }))
vi.mock('contexts/graphql-batcher', () => ({
  useGraphqlBatcher: () => ({
    graphqlBatcher: { fetch: async () => ({ registry }) },
  }),
}))
vi.mock('contexts/standard-tcr-view-context', async () => {
  const { createContext } =
    await vi.importActual<typeof import('react')>('react')
  return {
    StandardTCRViewContext: createContext(undefined),
    StandardTCRViewProvider: ({ children }: { children: React.ReactNode }) =>
      children,
  }
})
vi.mock('hooks/ethers-adapters', () => ({ useEthersProvider: () => undefined }))
vi.mock('hooks/arbitration-cost', () => ({
  default: () => ({ arbitrationCost: { toString: () => '20000000000000000' } }),
}))
vi.mock('hooks/native-currency', () => ({ default: () => 'xDAI' }))
vi.mock('hooks/factory', () => ({
  default: () => ({
    deployedWithStandardFactory: async () => true,
    deployedWithPermanentFactory: async () => true,
  }),
}))
vi.mock('hooks/token-symbol', () => ({
  default: () => ({
    symbol: 'sDAI',
    decimals: 18,
    decimalsRead: true,
    loading: false,
  }),
}))
vi.mock('./use-wallet-gate', () => ({ useWalletGate: () => ({}) }))
vi.mock('./use-submit-actions', () => ({
  useDepositSubmit: () => ({ submit: async () => {}, phase: 'idle' }),
  usePermanentSubmit: () => ({
    submit: async () => {},
    approve: async () => {},
    recheck: async () => {},
    phase: 'idle',
    submitting: false,
    approving: false,
    checking: false,
    checkFailed: false,
    balance: 10n ** 21n,
    allowance: 10n ** 21n,
    nativeBalance: 10n ** 21n,
  }),
}))
vi.mock('./duplicate-entry', () => ({ useDuplicateEntry: () => undefined }))
vi.mock('@reown/appkit/react', () => ({
  useAppKitState: () => ({ open: false }),
}))

/** The gateway answers every read of the list file with `answer`. */
const serveListFile = (answer: { status?: number; body: unknown }) => {
  const fetchMock = vi.fn(async () => ({
    ok: (answer.status ?? 200) < 400,
    status: answer.status ?? 200,
    json: async () => answer.body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderStakeSubmit = () =>
  renderWithProviders(
    <Routes>
      <Route path="/tcr/:chainId/:tcrAddress/submit" element={<SubmitItem />} />
    </Routes>,
    { route: `/tcr/100/${LIST}/submit` },
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Stake submit page: the list file', () => {
  it('shows only well-typed fields from a malformed file, instead of taking the page down', async () => {
    serveListFile({
      body: {
        metadata: {
          columns: [
            null,
            'not a column',
            // A label that is an object, a type that is a number.
            { label: { text: 'Logo' }, type: 7 },
            { label: 'Name', type: 'text', isIdentifier: true },
            { label: 'Website', type: 'link', description: { x: 1 } },
          ],
        },
      },
    })
    renderStakeSubmit()

    expect(
      await screen.findByRole('textbox', { name: 'Name' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Website' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Submit a tag to Stake tags',
    )
  })

  it('reads the file through the IPFS gateway, with a time limit', async () => {
    const fetchMock = serveListFile({
      body: { metadata: { columns: [{ label: 'Name', type: 'text' }] } },
    })
    renderStakeSubmit()

    await screen.findByRole('textbox', { name: 'Name' })
    // The signal is what ends a read the gateway never answers.
    expect(fetchMock).toHaveBeenCalledWith(
      `https://cdn.kleros.link${FILE_URI}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('offers to try again when the gateway answers with an error', async () => {
    // A JSON error page: read as a file, it was a form with no fields.
    serveListFile({ status: 504, body: { error: 'Gateway timeout' } })
    renderStakeSubmit()

    expect(
      await screen.findByRole('button', { name: /try again/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
