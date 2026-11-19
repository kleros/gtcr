import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import Tooltip from 'components/ui/Tooltip'
import { errorToast } from 'utils/wrap-with-toast'
import type { DashboardRegistry, RegistryKind } from 'pages/dashboard/types'
import { CurateIcon } from './icons'
import { Button } from './primitives'

/*
 * "Update list parameters" on a list's own page: a control only the list's
 * governor sees, and nothing for anyone else. It opens the dialog the
 * governor's profile uses (pages/address/governance.tsx), so a list is
 * changed one way wherever the governor starts.
 *
 * Whether the wallet governs the list comes from the governor the page
 * already reads on chain through the list's own chain, never the wallet's:
 * a governor whose wallet sits on another chain still sees the button, and
 * the dialog offers the switch before anything is signed.
 *
 * Nothing is drawn while the governor is unknown, so no button appears and
 * then goes. Once the wallet matches, the list's parameters are read ahead
 * of the click, and the button waits (aria-busy) only until that read
 * lands. After a governor transfer, the page's next read of the governor no
 * longer matches, and the button goes; so it does when the live read here
 * already names someone else.
 *
 * The dialog and the governance reads are loaded on demand: the profile's
 * governance module is large, and nobody but a governor needs it here.
 */

const GovernanceDialog = lazy(() =>
  import('pages/address/governance').then((module) => ({
    default: module.ListGovernanceDialog,
  })),
)

const lower = (address?: string | null) => (address ?? '').toLowerCase()

const fadeIn = keyframes`
  from { opacity: 0; }
`

/* The button fills the action column under the list's main action. Its
   tooltip wrapper is stretched with it, so the bubble centres on the
   button and not on the words. */
const Wrap = styled.div`
  margin-top: 6px;
  animation: ${fadeIn} 240ms cubic-bezier(0.16, 1, 0.3, 1) both;

  > .ui-tooltip-trigger {
    display: flex;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export interface ListGovernanceProps {
  /** The list's chain, from the URL: where the governor was read. */
  chainId: number
  /** The list's contract address. */
  address: string
  kind: RegistryKind
  /** The list's name, for the dialog's title and the transfer toast. */
  title?: string
  logoURI?: string
  /** Stake: the list's stake token. */
  token?: string
  /** Stake: the live MetaEvidence URI, if the page has it. */
  metaEvidenceURI?: string
  /** Stake: the live arbitrator extra data, if the page has it. */
  arbitratorExtraData?: string
  /**
   * The list's governor as the page read it on chain; undefined while that
   * read is pending (nothing is drawn until it lands).
   */
  governor?: string | null
  /** A save went through: read the list's settings and governor again. */
  onSaved?: () => void
}

export const ListGovernance = ({
  chainId,
  address,
  kind,
  title,
  logoURI,
  token,
  metaEvidenceURI,
  arbitratorExtraData,
  governor,
  onSaved,
}: ListGovernanceProps) => {
  const { address: account, isConnected } = useAccount()
  const [open, setOpen] = useState(false)
  const isGovernor =
    isConnected && !!account && !!governor && lower(account) === lower(governor)

  // The dashboard's shape for a list (its id format too), which the
  // governance reads and the dialog take; the counts play no part there.
  const registry = useMemo<DashboardRegistry>(
    () => ({
      id: `${kind}-${chainId}-${lower(address)}`,
      address: lower(address),
      chainId,
      kind,
      title: title || 'this list',
      logoURI,
      token,
      metaEvidenceURI,
      arbitratorExtraData,
      itemCount: 0,
      activeCount: 0,
      pendingCount: 0,
      disputeCount: 0,
      trustStatus: 'unknown',
    }),
    [
      kind,
      chainId,
      address,
      title,
      logoURI,
      token,
      metaEvidenceURI,
      arbitratorExtraData,
    ],
  )

  // Read as soon as the wallet matches, so the dialog opens on live values.
  const settings = useQuery({
    queryKey: ['listGovernance', chainId, lower(address)],
    queryFn: async () =>
      (await import('pages/address/data')).readListGovernance(registry),
    enabled: isGovernor,
    staleTime: 60_000,
  })

  // Fetch the dialog's code ahead of the click too.
  useEffect(() => {
    if (isGovernor) void import('pages/address/governance')
  }, [isGovernor])

  const transferred =
    !!settings.data?.governor && settings.data.governor !== lower(account)
  if (!isGovernor || transferred) return null

  const waiting = !settings.data && settings.isFetching
  const openDialog = async () => {
    if (settings.data) {
      setOpen(true)
      return
    }
    const result = await settings.refetch()
    if (result.data) setOpen(true)
    else
      errorToast(
        "This list's settings could not be read. Try again in a moment.",
      )
  }

  return (
    <Wrap>
      <Tooltip
        title={`You govern this list: change its ${
          kind === 'permanent' ? 'stake' : 'deposits'
        }, periods, court and policy.`}
      >
        <Button
          type="button"
          $variant="secondary"
          $block
          disabled={waiting}
          aria-busy={waiting || undefined}
          onClick={() => void openDialog()}
        >
          <CurateIcon name="layers" size={16} />
          Update list parameters
        </Button>
      </Tooltip>
      {open && settings.data && (
        <Suspense fallback={null}>
          <GovernanceDialog
            registry={settings.data}
            onSaved={() => {
              void settings.refetch()
              onSaved?.()
            }}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </Wrap>
  )
}

export default ListGovernance
