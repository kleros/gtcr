import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { CurateIcon } from 'components/curate/icons'
import { Small } from 'components/curate/primitives'

/*
 * Long text. On a detail page it shows the first lines and fades out at the
 * bottom edge; "Show more" opens the rest with a height glide. In a dense
 * place (rows, tables) it is one line with an ellipsis and the full text on
 * hover.
 */

const LINE = 22

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  max-width: 72ch;
`

const Text = styled.div`
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: ${LINE}px;
  white-space: pre-line;
  overflow-wrap: anywhere;
  transition: max-height 420ms var(--ease-out);

  &[data-clamped='true'] {
    -webkit-mask-image: linear-gradient(
      to bottom,
      var(--color-text) calc(100% - ${LINE * 2}px),
      transparent
    );
    mask-image: linear-gradient(
      to bottom,
      var(--color-text) calc(100% - ${LINE * 2}px),
      transparent
    );
  }
`

const Toggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  margin-left: -10px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--motion);

  &:hover {
    background: var(--color-primary-soft);
  }

  svg {
    transition: transform 320ms var(--ease-out);
  }

  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }
`

const Inline = styled.span`
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

interface LongTextProps {
  value?: string | null
  /** One line with an ellipsis, for rows and table cells. */
  compact?: boolean
  /** Lines shown before the fade on a detail page. */
  lines?: number
}

const LongText = ({ value, compact = false, lines = 5 }: LongTextProps) => {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const clamp = lines * LINE

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => setFull(node.scrollHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [value, compact])

  if (!value) return <Small $faint>No text</Small>

  if (compact)
    return (
      <Inline title={value.length > 600 ? `${value.slice(0, 600)}…` : value}>
        {value}
      </Inline>
    )

  const overflowing = full > clamp + 4

  return (
    <Wrap>
      <Text
        ref={ref}
        id={id}
        data-clamped={overflowing && !expanded}
        style={{ maxHeight: expanded ? full || 'none' : clamp }}
      >
        {value}
      </Text>
      {overflowing && (
        <Toggle
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((open) => !open)
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
          <CurateIcon name="chevron-down" size={14} />
        </Toggle>
      )}
    </Wrap>
  )
}

export default LongText
