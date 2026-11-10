import React, { useState, useCallback, useEffect } from 'react'
import styled from 'styled-components'
import { litEdgeBackground } from 'components/ui/kit-styles'
import { BigNumber } from 'ethers'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  Data,
  EmptyState,
  Label,
  SkeletonBlock,
  Small,
  Stack,
  Title,
} from 'components/curate/primitives'
import { Dialog } from 'components/curate/item-light-dialog'
import { formatAmount } from 'components/curate/item-light-format'

/*
 * Pick a badge list to submit this entry to. The deposit shown is the badge
 * list's own submission deposit; the submission itself opens the submit
 * flow with the matched columns pre-filled.
 */

const RadioList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
`

/*
 * One badge list per row, in the selector language: the chosen row is
 * encircled by the lit edge, and its radio is a ring whose centre lights.
 * Nothing is chosen until someone picks; the native radio keeps the
 * keyboard (arrows move and choose inside the group).
 */
const RadioRow = styled.label<{ $selected: boolean }>`
  --edge-angle: 210deg;
  position: relative;
  display: grid;
  grid-template-columns: 20px 48px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid
    ${({ $selected }) => ($selected ? 'transparent' : 'var(--color-border)')};
  border-radius: var(--radius);
  background: ${({ $selected }) =>
    $selected
      ? litEdgeBackground('var(--color-surface)')
      : 'var(--color-surface)'};
  box-shadow: ${({ $selected }) =>
    $selected
      ? '0 0 0 3px color-mix(in srgb, var(--edge-2) 12%, transparent), 0 10px 26px -16px var(--cta-glow)'
      : 'none'};
  cursor: pointer;
  transition:
    border-color var(--motion),
    box-shadow var(--motion);

  &:hover {
    border-color: ${({ $selected }) =>
      $selected ? 'transparent' : 'var(--color-border-strong)'};
  }

  input {
    appearance: none;
    position: relative;
    width: 16px;
    height: 16px;
    margin: 0;
    border: 1.5px solid var(--color-faint);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: border-color var(--motion);
  }

  input::after {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    background: var(--edge-2);
    box-shadow: 0 0 10px var(--edge-2);
    transform: scale(0);
    transition: transform var(--dur-control) var(--ease-spring);
  }

  input:checked {
    border-color: var(--edge-2);
  }

  input:checked::after {
    transform: scale(1);
  }

  input:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    input::after {
      transition: none;
    }
  }
`

const Logo = styled.img`
  width: 48px;
  height: 48px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  object-fit: contain;
  background: var(--color-raised);
`

const DepositLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
`

export interface BadgeInfo {
  tcrAddress: string
  fileURI?: string
  submissionDeposit: BigNumber
  metadata: { tcrTitle: string; logoURI: string; columns: Column[] }
  metaEvidence?: MetaEvidence
  matchFile?: { columns: (number | null)[] }
  decodedData?: unknown[]
  challengePeriodDuration?: BigNumber
  [key: string]: unknown
}

interface AddBadgeModalProps {
  onCancel: () => void
  availableBadges?: BadgeInfo[]
  visible?: boolean
  tcrAddress?: string
  connectedTCRAddr?: string
  onSelectBadge: (badge: BadgeInfo) => void
  onEnableNewBadge: () => void
  isFetchingBadges?: boolean
  foundBadges?: { tcrAddress: string }[]
}

const AddBadgeModal = ({
  onCancel,
  availableBadges,
  visible,
  tcrAddress,
  connectedTCRAddr,
  onSelectBadge,
  onEnableNewBadge,
  isFetchingBadges,
  foundBadges,
}: AddBadgeModalProps) => {
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()
  const [selectedBadge, setSelectedBadge] = useState<number>()
  const handleSubmit = useCallback(() => {
    if (!availableBadges || selectedBadge === undefined) return
    onSelectBadge(availableBadges[selectedBadge])
    onCancel()
  }, [availableBadges, onCancel, onSelectBadge, selectedBadge])

  const handleEnableNewBadge = useCallback(() => {
    onCancel()
    onEnableNewBadge()
  }, [onCancel, onEnableNewBadge])

  const filteredAvailableBadges = (availableBadges ?? []).filter(
    ({ tcrAddress: availableBadgeAddr }) =>
      !(foundBadges ?? [])
        .map((b) => b.tcrAddress)
        .includes(availableBadgeAddr),
  )

  // Select the first badge once the list is loaded so the displayed choice
  // and the component state never disagree.
  useEffect(() => {
    if (!filteredAvailableBadges || filteredAvailableBadges.length === 0) return
    setSelectedBadge(0)
  }, [availableBadges, filteredAvailableBadges, onSelectBadge])

  if (!availableBadges || !tcrAddress || !connectedTCRAddr || isFetchingBadges)
    return (
      <Dialog
        open={!!visible}
        onClose={onCancel}
        title="Add a badge"
        footer={
          <Button type="button" $variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        }
      >
        <SkeletonBlock $height="120px" />
      </Dialog>
    )

  const selected =
    selectedBadge === undefined ? undefined : availableBadges[selectedBadge]

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel}
      title="Add a badge"
      footer={
        <>
          <Button type="button" $variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            $variant="primary"
            onClick={handleSubmit}
            disabled={selectedBadge === undefined}
            aria-disabled={selectedBadge === undefined}
            title={selectedBadge === undefined ? 'Choose a badge' : undefined}
          >
            Continue
            {selected
              ? ` · ${formatAmount(selected.submissionDeposit, nativeCurrency)}`
              : ''}
          </Button>
        </>
      }
    >
      <Stack $gap={16}>
        <RadioList role="radiogroup" aria-label="Available badges">
          {filteredAvailableBadges.map(
            ({ fileURI, metadata: { tcrTitle, logoURI } }, i) => (
              <RadioRow key={i} $selected={selectedBadge === i}>
                <input
                  type="radio"
                  name="badge"
                  value={i}
                  checked={selectedBadge === i}
                  onChange={() => setSelectedBadge(i)}
                />
                <Logo src={parseIpfs(logoURI)} alt="" />
                <div style={{ minWidth: 0 }}>
                  <Title>{tcrTitle}</Title>
                  <Button
                    type="button"
                    $variant="ghost"
                    $size="sm"
                    disabled={!fileURI}
                    onClick={(event) => {
                      event.preventDefault()
                      if (fileURI) openAttachment(parseIpfs(fileURI), true)
                    }}
                  >
                    <CurateIcon name="policy" size={14} />
                    Listing policy
                  </Button>
                </div>
              </RadioRow>
            ),
          )}
          {filteredAvailableBadges.length === 0 && (
            <EmptyState icon="verified" title="No badges available">
              No badge list is connected to this list yet.
            </EmptyState>
          )}
        </RadioList>
        <div>
          <Button
            type="button"
            $variant="ghost"
            $size="sm"
            onClick={handleEnableNewBadge}
          >
            Enable a new badge
          </Button>
        </div>
        {filteredAvailableBadges.length > 0 && (
          <DepositLine>
            <div>
              <Label>Deposit</Label>
              <Small $muted>
                {' '}
                Back after the challenge period; in a dispute, it goes to the
                side the jurors agree with.
              </Small>
            </div>
            <Data>
              {formatAmount(
                selected ? selected.submissionDeposit : 0,
                nativeCurrency,
              )}
            </Data>
          </DepositLine>
        )}
      </Stack>
    </Dialog>
  )
}

export default AddBadgeModal
