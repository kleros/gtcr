import React from 'react'
import styled, { keyframes } from 'styled-components'
import type { ListLayout } from 'hooks/use-stored-layout'
import { Body, Grid, SkeletonBlock, Stack, Surface, Title } from './primitives'

/*
 * The Light registry list's two stand-ins for rows: a skeleton shaped like
 * the layout it replaces (table, rows or cards), so nothing jumps when the
 * entries land, and an empty state (a soft halo behind three fanned tiles
 * that drift, one title, at most one line, one action) whose copy and
 * action the page picks from why the list is empty.
 */

/* ---------- Skeleton ---------- */

const TableSkeleton = styled.div`
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: inset 0 1px 0 var(--glass-highlight);

  > div {
    display: grid;
    grid-template-columns: 1.3fr 1.4fr 1fr 1fr 1fr;
    align-items: center;
    gap: 32px;
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid var(--glass-border);
  }

  > div:first-child {
    height: 44px;
  }

  > div:last-child {
    border-bottom: 0;
  }

  @media (max-width: 720px) {
    > div {
      grid-template-columns: 1fr 1.2fr;
      gap: 20px;
    }

    > div > :nth-child(n + 3) {
      display: none;
    }
  }
`

/* A row's outline with its parts: name and meta on the left, the status and
   its countdown on the right, as the real row lays them out. */
const RowSkeleton = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 200px);
  align-items: center;
  gap: 24px;
  min-height: 76px;
  padding: 16px 20px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: inset 0 1px 0 var(--glass-highlight);

  > div {
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-width: 0;
  }

  > div:last-child {
    align-items: flex-end;
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 14px;

    > div:last-child {
      align-items: flex-start;
    }
  }
`

const CardSkeleton = styled(SkeletonBlock)`
  border-radius: var(--radius-lg);
`

const TABLE_WIDTHS = ['72%', '86%', '64%', '58%', '70%']
const ROW_WIDTHS = ['38%', '52%', '30%', '46%', '34%', '58%', '42%', '48%']

export const RegistryLightSkeleton = ({ layout }: { layout: ListLayout }) => {
  if (layout === 'cards')
    return (
      <Grid $min={260} aria-hidden>
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} $height="265px" />
        ))}
      </Grid>
    )
  if (layout === 'rows')
    return (
      <Stack $gap={8} aria-hidden>
        {ROW_WIDTHS.map((width, index) => (
          <RowSkeleton key={index}>
            <div>
              <SkeletonBlock $width={width} $height="14px" />
              <SkeletonBlock $width="24%" $height="10px" />
            </div>
            <div>
              <SkeletonBlock $width="76%" $height="12px" />
              <SkeletonBlock $width="100%" $height="4px" />
            </div>
          </RowSkeleton>
        ))}
      </Stack>
    )
  return (
    <TableSkeleton aria-hidden>
      {Array.from({ length: 9 }).map((_, row) => (
        <div key={row}>
          {TABLE_WIDTHS.map((width, column) => (
            <SkeletonBlock
              key={column}
              $width={row === 0 ? '44%' : width}
              $height={row === 0 ? '8px' : '12px'}
            />
          ))}
        </div>
      ))}
    </TableSkeleton>
  )
}

/* ---------- Empty state ---------- */

const drift = keyframes`
  from { transform: translateX(var(--x)) rotate(calc(var(--r) - 3deg)); }
  to { transform: translateX(var(--x)) rotate(calc(var(--r) + 3deg)); }
`

const Stage = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px 24px 36px;
  overflow: hidden;
  text-align: center;

  /* The halo the tiles sit in. */
  &::before {
    content: '';
    position: absolute;
    top: -40px;
    left: 50%;
    z-index: -1;
    width: 420px;
    height: 240px;
    transform: translateX(-50%);
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--color-primary) 18%, transparent),
      transparent
    );
    pointer-events: none;
  }
`

const Fan = styled.div`
  position: relative;
  width: 150px;
  height: 92px;
  margin-bottom: 14px;
`

const Tile = styled.span`
  position: absolute;
  top: 4px;
  left: 50%;
  width: 60px;
  height: 78px;
  margin-left: -30px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  /* The raised tint over an opaque surface, so the tile behind never shows
     through (the raised token is translucent in the dark themes). */
  background:
    linear-gradient(var(--color-raised), var(--color-raised)),
    var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-card);
  transform: translateX(var(--x)) rotate(var(--r));
  transform-origin: 50% 120%;
  animation: ${drift} 6s var(--ease-in-out) infinite alternate;
  animation-delay: var(--d);

  /* A title bar and a shorter meta bar, the way a row reads. */
  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 10px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--color-border-strong);
  }

  &::before {
    top: 14px;
    width: 34px;
  }

  &::after {
    top: 26px;
    width: 22px;
    opacity: 0.6;
  }

  &:nth-child(2) {
    z-index: 1;

    &::before {
      background: color-mix(in srgb, var(--color-primary) 60%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const TILES = [
  { x: '-34px', r: '-10deg', d: '0s' },
  { x: '0px', r: '0deg', d: '-2s' },
  { x: '34px', r: '10deg', d: '-4s' },
]

export const RegistryLightEmpty = ({
  title,
  line,
  action,
}: {
  title: string
  line?: string
  action?: React.ReactNode
}) => (
  <Surface $padding="none">
    <Stage>
      <Fan aria-hidden>
        {TILES.map((tile) => (
          <Tile
            key={tile.r}
            style={
              {
                '--x': tile.x,
                '--r': tile.r,
                '--d': tile.d,
              } as React.CSSProperties
            }
          />
        ))}
      </Fan>
      <Title as="h2">{title}</Title>
      {line && <Body $muted>{line}</Body>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </Stage>
  </Surface>
)
