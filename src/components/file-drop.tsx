import React, { useCallback, useEffect, useState } from 'react'
import styled, { css } from 'styled-components'
import {
  edgeTransition,
  flatFill,
  kitRadius,
  kitTransition,
  litEdgeBackground,
} from 'components/ui/kit-styles'

/*
 * Drag and drop for every place a file is attached: the submit page's image
 * and file columns, the evidence form in both its layouts (the entry page's
 * composer and the evidence, challenge and remove dialogs), the entry
 * dialogs' picture cards, the logo and policy of both list factories, and
 * the governor's MetaEvidence field.
 *
 * One language for all of them. A file dragged over a zone lights its edge
 * (DESIGN.md, "Lit edge": light on the edge, never a flat fill); a drag the
 * zone cannot take says why while it is still held, rather than after it
 * lands; and a dropped file goes through the same validation and the same
 * state write as the one chosen with the browse button. Nothing here
 * replaces the buttons: a drag is a shortcut, and touch devices have none.
 */

/** "Drop to attach" and the one-file rule, in the same words everywhere. */
export const DROP_HINT = 'Drop to attach'
export const DROP_REPLACE = 'Drop to replace'
const ONE_FILE_ONLY = 'One file at a time.'
const NOT_A_FOLDER = 'Drop a file, not a folder.'

/**
 * Whether a drag carries files. Everything below acts only on those: a
 * dragged selection or link keeps its native behaviour, so text dropped in
 * a textarea still lands in the text.
 */
const hasFiles = (transfer: DataTransfer): boolean =>
  transfer.types.includes('Files')

/**
 * How many files a drag holds. While it is held a browser exposes only the
 * kinds, never a name or a size, and some expose nothing at all: one file
 * is the safe reading, since a drag with files carries at least one.
 */
const draggedFileCount = (transfer: DataTransfer): number => {
  const { items } = transfer
  if (!items || items.length === 0) return 1
  let files = 0
  for (const item of items) if (item.kind === 'file') files += 1
  return files || 1
}

type DropResult =
  | { kind: 'file'; file: File }
  | { kind: 'problem'; problem: string }
  | { kind: 'empty' }

/**
 * What a drop holds: the one file, the reason it cannot be taken, or
 * nothing. One file at a time, because every field here holds one; a folder
 * arrives as a file with an empty type and would fail at upload, and only
 * the drag's entry says it is one, so where a browser has no item list a
 * folder cannot be told apart and the type and size checks have it.
 */
const fileFromDrop = (transfer: DataTransfer): DropResult => {
  const { files } = transfer
  if (files.length > 1) return { kind: 'problem', problem: ONE_FILE_ONLY }
  const file = files[0]
  if (!file) return { kind: 'empty' }
  const entry = transfer.items?.[0]
  if (
    entry &&
    typeof entry.webkitGetAsEntry === 'function' &&
    entry.webkitGetAsEntry()?.isDirectory
  )
    return { kind: 'problem', problem: NOT_A_FOLDER }
  return { kind: 'file', file }
}

/*
 * A file dropped just outside a zone would make the browser open it in
 * place of the page, losing a drafted form. The zones take their own (they
 * prevent the default first, and React 18 listens on the root container and
 * on each portal's container, so a zone's handler has run by the time the
 * event reaches the window — the dialogs portalled to <body> included);
 * anywhere else a dragged file cannot be dropped.
 *
 * Several zones and the page itself ask for this guard, so the window
 * listeners are counted in one place: a double mount (React's strict mode)
 * stays balanced.
 */
let guards = 0

const refuseStrayDrop = (event: DragEvent) => {
  if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files'))
    return
  event.preventDefault()
  if (event.type === 'dragover') event.dataTransfer.dropEffect = 'none'
}

export const useFileDropGuard = (): void => {
  useEffect(() => {
    guards += 1
    if (guards === 1) {
      window.addEventListener('dragover', refuseStrayDrop)
      window.addEventListener('drop', refuseStrayDrop)
    }
    return () => {
      guards -= 1
      if (guards === 0) {
        window.removeEventListener('dragover', refuseStrayDrop)
        window.removeEventListener('drop', refuseStrayDrop)
      }
    }
  }, [])
}

/**
 * Whether the pointer only crossed between the zone and something inside
 * it. A dragleave fires on the zone when the pointer moves onto a child as
 * well as when it really leaves: without this the zone flickers under the
 * cursor and can be left lit.
 */
const movingInside = (event: React.DragEvent<HTMLElement>): boolean => {
  const related = event.relatedTarget
  return related instanceof Node && event.currentTarget.contains(related)
}

export interface FileDrop<T extends HTMLElement> {
  /** A file is being dragged over the zone. */
  over: boolean
  /** Why this drag will not be taken; '' while it will. */
  refusal: string
  handlers: {
    onDragEnter: React.DragEventHandler<T>
    onDragOver: React.DragEventHandler<T>
    onDragLeave: React.DragEventHandler<T>
    onDrop: React.DragEventHandler<T>
  }
}

export const useFileDrop = <T extends HTMLElement = HTMLElement>({
  blocked,
  onFile,
  onRefuse,
}: {
  /** Why the zone takes nothing right now; it says so during the drag. */
  blocked?: string
  onFile: (file: File) => void
  /** The same message the browse button's validation would have shown. */
  onRefuse?: (problem: string) => void
}): FileDrop<T> => {
  const [over, setOver] = useState(false)
  const [refusal, setRefusal] = useState('')
  useFileDropGuard()

  const reasonFor = useCallback(
    (transfer: DataTransfer): string =>
      blocked || (draggedFileCount(transfer) > 1 ? ONE_FILE_ONLY : ''),
    [blocked],
  )

  /*
   * A drag that ends anywhere else leaves no event on the zone: dropped
   * past it, or cancelled with Escape over it in a browser that sends no
   * dragleave. The window says when it is over, so nothing stays lit.
   */
  useEffect(() => {
    if (!over) return undefined
    const done = () => {
      setOver(false)
      setRefusal('')
    }
    window.addEventListener('drop', done)
    window.addEventListener('dragend', done)
    return () => {
      window.removeEventListener('drop', done)
      window.removeEventListener('dragend', done)
    }
  }, [over])

  const onDragEnter = useCallback(
    (event: React.DragEvent<T>) => {
      if (!hasFiles(event.dataTransfer)) return
      event.preventDefault()
      if (movingInside(event)) return
      setOver(true)
      setRefusal(reasonFor(event.dataTransfer))
    },
    [reasonFor],
  )

  const onDragOver = useCallback(
    (event: React.DragEvent<T>) => {
      if (!hasFiles(event.dataTransfer)) return
      // Claiming the drag is what lets it be dropped at all, and what keeps
      // the window guard above off this event.
      event.preventDefault()
      const reason = reasonFor(event.dataTransfer)
      event.dataTransfer.dropEffect = reason ? 'none' : 'copy'
      setOver(true)
      setRefusal(reason)
    },
    [reasonFor],
  )

  const onDragLeave = useCallback((event: React.DragEvent<T>) => {
    if (movingInside(event)) return
    setOver(false)
    setRefusal('')
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent<T>) => {
      if (!hasFiles(event.dataTransfer)) return
      event.preventDefault()
      setOver(false)
      setRefusal('')
      // Blocked: the zone said why while the file was held (and a drop
      // refused with dropEffect 'none' is not even delivered in Chrome), so
      // nothing is reported afterwards over the field's own message.
      if (blocked) return
      const result = fileFromDrop(event.dataTransfer)
      if (result.kind === 'problem') onRefuse?.(result.problem)
      else if (result.kind === 'file') onFile(result.file)
    },
    [blocked, onFile, onRefuse],
  )

  return {
    over,
    refusal,
    handlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}

/*
 * The inside of a zone while a file is held over it: the zone's own raised
 * tint with a touch of the accent, laid on the surface so that it is
 * opaque. The lit edge is a conic gradient painted under the whole border
 * box, and the raised tint is translucent in the dark and Kleros themes
 * (4.5% and 5% white), so on its own it let the blue, cyan and purple wash
 * through the entire zone instead of lighting only its 1px edge. On the
 * light theme the raised tint is already opaque and nothing changes.
 */
const DROP_TINT =
  'color-mix(in srgb, var(--color-primary) 6%, var(--color-raised))'
const dropFill = `${flatFill(DROP_TINT)} padding-box, ${flatFill(
  'var(--color-surface)',
)}`

/**
 * What a drop zone wears while a file is held over it: the lit conic edge
 * with an edge-2 halo around an opaque fill, or a status hairline over a
 * faint tint when the drag cannot be taken. The border stays 1px in every
 * state, so nothing shifts under the cursor.
 *
 * Shared, so the wells here and the upload rows that are not wells (the two
 * list factories, the governor's MetaEvidence field, the picture card) light
 * the same way. A zone that uses it declares `position: relative`, its own
 * `--edge-angle` at rest and a 1px border; DESIGN.md asks for light on the
 * edge, never a flat fill.
 */
export const fileDropEdge = css<{ $over?: boolean; $refusing?: boolean }>`
  ${({ $refusing }) =>
    $refusing &&
    css`
      && {
        border-style: solid;
        border-color: var(--color-danger);
        background: var(--color-danger-soft);
      }
    `}

  ${({ $over, $refusing }) =>
    $over &&
    !$refusing &&
    css`
      && {
        --edge-angle: 570deg;
        border-style: solid;
        border-color: transparent;
        /* litEdgeBackground clips its fill to the padding box; the
           surface under the tint is clipped there too, so only the 1px
           edge shows the conic layer. */
        background: ${litEdgeBackground(dropFill)};
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--edge-2) 12%, transparent);
      }
    `}
`

/**
 * The well a file is dropped on: a dashed hairline at rest, and the shared
 * drop state above once a file is over it.
 */
export const FileDropWell = styled.div<{
  $over?: boolean
  $refusing?: boolean
  $invalid?: boolean
  $disabled?: boolean
}>`
  --edge-angle: 210deg;
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 88px;
  padding: 16px;
  border: 1px dashed
    ${({ $invalid, $disabled }) =>
      $invalid
        ? 'var(--color-danger)'
        : $disabled
          ? 'var(--glass-border)'
          : 'var(--color-border-strong)'};
  border-radius: ${kitRadius.well};
  background: var(--color-raised);
  transition:
    ${kitTransition('border-color', 'background', 'box-shadow')},
    ${edgeTransition};

  @media (max-width: 520px) {
    flex-direction: column;
    align-items: flex-start;
  }

  ${fileDropEdge}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/**
 * What a box that is not itself a well says while a file is held over it
 * (the evidence composer's message box, the upload rows of the factories,
 * the governor's MetaEvidence field and the picture card). It never takes
 * the pointer, so hit-testing, the fields under it and the drag events all
 * carry on.
 *
 * It is opaque, inside the box's 1px edge: the message is the one thing the
 * box says while the file is held. A see-through veil let the row's own
 * text show under the message (an upload row's "PNG, SVG, WebP or JPEG ·
 * under 2 MB" ran into "Connect wallet to upload the logo."), and in the
 * dark and Kleros themes it let the lit edge's conic wash through the whole
 * box. The fields come back, untouched, the moment the drag ends.
 *
 * The accent wash is the "will be taken" half of the message. A refused
 * drag swaps it for the danger tint the box's refusing edge state wears,
 * never the accent mixed into the status colour.
 */
export const FileDropVeil = styled.div.attrs({ 'aria-hidden': true })<{
  $refusing?: boolean
}>`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
  place-content: center;
  place-items: center;
  padding: 0 16px;
  border-radius: inherit;
  background: ${({ $refusing }) =>
    `${flatFill(
      $refusing ? 'var(--color-danger-soft)' : DROP_TINT,
    )}, ${flatFill('var(--color-surface)')}`};
  text-align: center;
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  pointer-events: none;
`
