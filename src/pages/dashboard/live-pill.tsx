import React from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * The pill over the dashboard's title: what the figures under it are. It
 * says "Live", with its pulsing dot, only about a load it has, recent and
 * read without error. Before the first load there is nothing to call live:
 * a first visit (no saved load) used to read "Live · Connecting to the
 * indexers" for the seconds the load took, and for good when it failed.
 * Now it says it is connecting, on a still dot, and a read that failed
 * with nothing to show says the indexers are not answering, as Browse's
 * pill does (FreshnessPill in pages/browse).
 */

/** What the pill says about the figures. */
export type LoadState =
  /** No load yet: the first read is running. */
  | 'connecting'
  /** Nothing to show: the read failed, or no list in scope answered. */
  | 'down'
  /** Some chain in scope did not answer: the figures may be incomplete. */
  | 'partial'
  /** A recent load, and the last read worked. */
  | 'live'
  /** An older load (saved, or the tab was in the background), or a load whose refresh failed. */
  | 'aged'

export const loadState = ({
  loaded,
  failed,
  unanswered,
  partial,
  live,
}: {
  /** A load is on screen. */
  loaded: boolean
  /** The last read failed (React Query's isError). */
  failed: boolean
  /** No list in scope loaded: the indexers did not answer. */
  unanswered: boolean
  /** Some chain in scope did not answer. */
  partial: boolean
  /** The load is recent (query.ts: isLiveLoad). */
  live: boolean
}): LoadState => {
  if (!loaded) return failed ? 'down' : 'connecting'
  if (unanswered) return 'down'
  if (partial) return 'partial'
  return live && !failed ? 'live' : 'aged'
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-registered) 55%, transparent); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;

  b {
    color: var(--color-primary);
    font-weight: 500;
  }

  i {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--status-neutral);
  }

  /* Only a live load pulses. */
  &[data-state='live'] i {
    background: var(--status-registered);
    animation: ${pulse} 2.4s infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  /* Some indexer did not answer: the figures are partial, not live. */
  &[data-state='partial'] {
    b {
      color: var(--color-warning);
    }

    i {
      background: var(--status-contested);
    }
  }

  /* Nothing loaded: the indexers did not answer at all. */
  &[data-state='down'] i {
    background: var(--status-off);
  }

  /* An older load (the tab was in the background): shown, not called live. */
  &[data-state='aged'] {
    b {
      color: var(--color-muted);
    }

    i {
      background: var(--color-muted);
    }
  }
`

/* The pill's state word and what went wrong, spaced as the pill spaces them. */
const PillState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

export const LoadStatePill = ({
  state,
  refreshing,
  partialNames,
  updated,
  style,
}: {
  state: LoadState
  /** A newer load is on its way (said instead of "Not live"). */
  refreshing?: boolean
  /** The chains whose data did not load, named, when `state` is partial. */
  partialNames?: string
  /** "Updated 3 min ago", after the state, when the load's age is worth saying. */
  updated?: string
  style?: React.CSSProperties
}) => (
  <Pill style={style} data-state={state}>
    <i aria-hidden />
    {/* Only the state is announced: the age after it changes every minute,
        and a live region would read it out each time. */}
    <PillState role="status">
      {state === 'live' && <b>Live</b>}
      {state === 'partial' && <b>Partial</b>}
      {state === 'aged' && <b>{refreshing ? 'Refreshing' : 'Not live'}</b>}
      {state === 'connecting'
        ? 'Connecting to the indexers'
        : state === 'down'
          ? 'Indexers not answering'
          : state === 'partial'
            ? `Some ${partialNames} data did not load; figures may be incomplete`
            : null}
    </PillState>
    {updated}
  </Pill>
)
