import React from 'react'
import styled from 'styled-components'

/*
 * The mark of a Stake list (PermanentGTCR), the one kind that differs from
 * the default. A list without it is a standard Curate list, so standard
 * lists carry no kind label at all: the tag is the exception, its absence
 * is neutral (the same rule as the Kleros Verified seal).
 *
 * The look follows the old frontend's Stake tag (logo-stake-tag.svg): a
 * slanted indigo label with spaced capitals. The box is skewed and the word
 * skewed back, so the border and the corners stay crisp at any size, and
 * the text is indigo mixed toward the theme's text so it reads at 4.5:1 or
 * more on its soft fill in every theme.
 *
 *   <StakeTag />            rows and cards: 18px tall, sits after the seal
 *   <StakeTag size="md" />  a list's own header: the chip row's 24px
 */

export const STAKE_TAG_TITLE =
  'Stake list: an entry’s stake stays locked while it is listed, and a successful challenge takes it.'

const Box = styled.span<{ $size: 'sm' | 'md' }>`
  display: inline-flex;
  flex: none;
  align-items: center;
  height: ${({ $size }) => ($size === 'md' ? '22px' : '17px')};
  padding: 0 ${({ $size }) => ($size === 'md' ? '10px' : '7px')};
  margin: 0 2px;
  border-radius: 3px;
  background: var(--color-indigo-soft);
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--color-indigo) 32%, transparent);
  transform: skewX(-14deg);
  white-space: nowrap;

  > span {
    display: block;
    transform: skewX(14deg);
    color: color-mix(in srgb, var(--color-indigo) 78%, var(--color-text));
    font-size: ${({ $size }) => ($size === 'md' ? '11px' : '9.5px')};
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    /* The spacing trails the last letter: pull it back to centre the word. */
    margin-right: -0.16em;
  }
`

export const StakeTag = ({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md'
  className?: string
}) => (
  <Box $size={size} className={className} title={STAKE_TAG_TITLE}>
    <span>Stake</span>
  </Box>
)

/** The tag for a Stake list, nothing for a standard one. */
export const KindTag = ({
  kind,
  size,
}: {
  kind: 'standard' | 'permanent'
  size?: 'sm' | 'md'
}) => (kind === 'permanent' ? <StakeTag size={size} /> : null)
