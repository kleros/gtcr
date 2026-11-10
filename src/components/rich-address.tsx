import React from 'react'
import styled from 'styled-components'
import { Tooltip } from 'components/ui'
import { ChromeAddress, Unseen } from 'components/curate/chrome-address'
import { Small, StatusDot, truncateMiddle } from 'components/curate/primitives'
import { parseRichAddress } from '../utils/rich-address'

/*
 * A multichain address ("eip155:100:0x…"): the network label as a small pill,
 * the address in mono linking to that network's explorer, plus copy. An
 * address that fails its network's format is marked with a warning dot and
 * the word "Invalid", never by colour alone.
 */

const Unknown = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  overflow-wrap: anywhere;

  > span:first-child {
    transform: translateY(-1px);
  }
`

const Flagged = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
`

/** Dot and word stay together, ahead of the address they qualify. */
const Verdict = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  /* Words, not data: sans even inside a mono cell. */
  font-family: var(--font-sans);
  white-space: nowrap;
`

const RichAddress: React.FC<{ crude: string }> = ({ crude }) => {
  const richAddress = parseRichAddress(crude)
  if (richAddress === null)
    return (
      <Unknown>
        <StatusDot $tone="off" aria-hidden />
        <span>Unknown address “{crude}”</span>
      </Unknown>
    )

  const { address, reference, link, passedTest } = richAddress
  if (!passedTest)
    return (
      <Tooltip title="This address is not valid">
        <Flagged>
          <Verdict>
            <StatusDot $tone="contested" aria-hidden />
            <Small $muted>
              Invalid
              <Unseen> address for this network:</Unseen>
            </Small>
          </Verdict>
          <ChromeAddress
            address={address}
            href={link}
            prefix={reference.label}
            display={truncateMiddle(address, 6, 4)}
            invalid
          />
        </Flagged>
      </Tooltip>
    )

  return (
    <ChromeAddress
      address={address}
      href={link}
      prefix={reference.label}
      display={truncateMiddle(address, 6, 4)}
    />
  )
}

export default RichAddress
