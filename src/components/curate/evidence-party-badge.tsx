import React from 'react'
import styled from 'styled-components'
import { Chip } from './primitives'

/*
 * Who filed a piece of evidence, said on the row that holds it (round 3 of
 * the design review: the part a sender played used to be a lowercase word at
 * the end of a muted sentence, and only for the two sides, so a juror's
 * filing read as a bare address).
 *
 * Only the three parties the chain names are badged: the side that made the
 * request, the challenger, and an address the court drew as a juror.
 * Anyone else gets no badge at all — a wrong badge is worse than none, and
 * the jury read only covers the rounds it can read seat by seat, so a juror
 * of an older round would otherwise be labelled as somebody else.
 *
 * No colour of its own: the row's marker already carries the side's status
 * tone, and status colours mean status.
 */

export type EvidenceParty = 'requester' | 'challenger' | 'juror'

const Badge = styled(Chip)`
  height: 20px;
  margin-left: 8px;
  padding: 0 8px;
  vertical-align: 1px;
`

/**
 * The badge, or nothing when the sender is none of the three. The words
 * come from here and nowhere else, so every row names a party the same way.
 */
export const EvidencePartyBadge = ({
  party,
  requesterLabel,
}: {
  party?: EvidenceParty
  /** What the requesting side is called here: "Submitter" or "Requester". */
  requesterLabel: string
}) => {
  if (!party) return null
  return (
    <Badge>
      {party === 'challenger'
        ? 'Challenger'
        : party === 'juror'
          ? 'Juror'
          : requesterLabel}
    </Badge>
  )
}

export default EvidencePartyBadge
