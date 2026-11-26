import React, {
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import styled from 'styled-components'
import { loadInBackground } from 'utils/background-preload'
import { linkify } from './item-standard-linkify'
import { rendersAsMarkdown } from './evidence-markdown-guard'

// The Markdown renderer weighs 36 KB gzipped: loaded by the first
// description that has Markdown in it, which until then reads as plain text.
// A load that fails (a tab on an older release) leaves it plain: it never
// reloads the page, which would lose a draft in the composer.
const EvidenceMarkdown = lazy(() =>
  loadInBackground(() => import('./evidence-markdown')),
)

const Clamp = styled.div<{ $clamped: boolean }>`
  min-width: 0;

  ${({ $clamped }) =>
    $clamped &&
    `
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`

const MoreButton = styled.button`
  /* A 24px tap target without moving the line: padding out, margin back. */
  padding: 3px 0;
  margin: -3px 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

/**
 * An evidence's description, in both histories. It opens at six lines, with
 * "Read all" only when the clamp hides something: measured, as the jury's
 * justifications are, since Markdown's lists and spacing make the length a
 * poor guess. URLs are links; tabbing onto one hidden by the clamp opens the
 * text first. Markdown renders as such (evidence-markdown.tsx); text the
 * renderer could not take, or that fails in it, reads as plain text.
 *
 * Only text that can pass six lines on a phone (about 40 characters a line)
 * is clamped at all: the clamp clips what crosses its edge, a focused link's
 * ring included, and short text has nothing to hide.
 */
const EvidenceText = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const markdown = useMemo(() => rendersAsMarkdown(text), [text])
  const plain = useMemo(() => <p>{linkify(text)}</p>, [text])
  const clampable = text.length > 240 || text.split(/\r\n|\r|\n/).length > 6

  const measure = useCallback(() => {
    const element = ref.current
    if (element && clampable && !expanded)
      setOverflowing(element.scrollHeight > element.clientHeight + 1)
  }, [clampable, expanded])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || expanded) return undefined
    if (!clampable) {
      setOverflowing(false)
      return undefined
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [clampable, expanded, text, measure])

  return (
    <>
      <Clamp
        ref={ref}
        $clamped={clampable && !expanded}
        onFocus={() => {
          if (overflowing) setExpanded(true)
        }}
      >
        {markdown ? (
          <ErrorBoundary fallback={plain} resetKeys={[text]}>
            <Suspense fallback={plain}>
              {/* The formatted text can be shorter or longer than the
                  plain one shown while it loaded: measured again. */}
              <EvidenceMarkdown text={text} onShown={measure} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          plain
        )}
      </Clamp>
      {(overflowing || expanded) && (
        <MoreButton
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read all'}
        </MoreButton>
      )}
    </>
  )
}

export default EvidenceText
