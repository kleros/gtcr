import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import styled, { keyframes } from 'styled-components'
import { ErrorBoundaryContext } from 'react-error-boundary'
import useDocumentHead from 'hooks/use-document-head'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonLink,
  Label,
  Page,
  StatusDot,
} from 'components/curate/primitives'
import { reveal } from 'components/curate/motion/reveal'

/*
 * Error page: one centred moment. The code is the display figure, rising
 * out of a horizon of light; one line says what happened (the caller's
 * message, if it has one, sits quietly under it); one action leads home. A
 * 404 also names the path that was asked for, so the reader can see a typo.
 *
 * As the app's crash screen (an error boundary's fallback) the way home
 * also clears the boundary: otherwise the URL would change while the same
 * error stayed on screen.
 *
 * The page names itself in the document title, and a 4xx page (nothing to
 * find at this URL) asks search engines not to index it while it is shown.
 */

const rise = keyframes`
  from { opacity: 0; transform: translateY(62%); }
  to { opacity: 1; transform: none; }
`

const dawn = keyframes`
  from { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
  to { opacity: 1; transform: translateX(-50%) scaleY(1); }
`

const draw = keyframes`
  from { opacity: 0; transform: scaleX(0); }
  to { opacity: 1; transform: scaleX(1); }
`

/*
 * The stage fills the viewport between what sits above it (the app bar) and
 * the footer, and not a pixel more: both are measured (useFitViewport), as
 * the footer stacks on phones and the crash screen has neither. Until then
 * it assumes the desktop bar and footer, 65px each.
 */
const Stage = styled(Page)`
  display: grid;
  place-items: center;
  min-height: calc(100vh - var(--above, 65px) - var(--below, 65px));
  min-height: calc(100svh - var(--above, 65px) - var(--below, 65px));
  padding-top: 32px;
  padding-bottom: 64px;
`

const Moment = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 620px;
  text-align: center;

  > *:not([data-digits]) {
    ${reveal}
  }
`

/*
 * The code stands on a horizon of light: the digits rise out of a bright
 * hairline, and a soft dawn spreads up behind them from it. Local light,
 * not a page background.
 */
const CodeStage = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 22px;
`

const Dawn = styled.span`
  position: absolute;
  bottom: 0;
  left: 50%;
  z-index: -1;
  width: min(820px, 160vw);
  height: max(150%, 180px);
  background: radial-gradient(
    50% 72% at 50% 100%,
    color-mix(in srgb, var(--aurora-b) 38%, transparent),
    color-mix(in srgb, var(--color-primary) 12%, transparent) 52%,
    transparent 78%
  );
  transform-origin: 50% 100%;
  pointer-events: none;
  animation: ${dawn} 1400ms var(--ease-out) 200ms both;

  /* Narrow: the light keeps to the content and fades out at its sides, so it
     never runs into the screen edge or ends in a hard cut along the horizon. */
  @media (max-width: 720px) {
    width: 100%;
    -webkit-mask-image: linear-gradient(
      90deg,
      transparent,
      #000 22%,
      #000 78%,
      transparent
    );
    mask-image: linear-gradient(
      90deg,
      transparent,
      #000 22%,
      #000 78%,
      transparent
    );
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: translateX(-50%);
  }
`

const Horizon = styled.span<{ $gap?: boolean }>`
  position: relative;
  display: block;
  margin-top: ${({ $gap }) => ($gap ? '22px' : '0')};
  width: min(560px, 92%);
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--aurora-b) 80%, transparent) 24%,
    color-mix(in srgb, var(--aurora-a) 70%, var(--color-primary)) 50%,
    color-mix(in srgb, var(--aurora-b) 80%, transparent) 76%,
    transparent
  );
  animation: ${draw} 1000ms var(--ease-out) 80ms both;

  /* The hot core of the line, where the light is strongest. */
  &::before {
    content: '';
    position: absolute;
    top: -0.5px;
    left: 30%;
    right: 30%;
    height: 2px;
    border-radius: var(--radius-pill);
    /* Hot is white on the dark stages, the saturated accent on light. */
    background: linear-gradient(
      90deg,
      transparent,
      ${({ theme }) =>
        theme.name === 'light' ? 'var(--color-primary)' : 'var(--color-text)'},
      transparent
    );
    box-shadow: 0 0 16px 2px
      color-mix(in srgb, var(--aurora-b) 70%, transparent);
  }

  /* A little light spilling below the horizon. */
  &::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 10%;
    right: 10%;
    height: 56px;
    background: radial-gradient(
      50% 100% at 50% 0%,
      color-mix(in srgb, var(--aurora-b) 16%, transparent),
      transparent
    );
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Code = styled.p`
  display: flex;
  justify-content: center;
  margin: 0;
  padding: 0 0.04em;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(112px, 15vw + 40px, 232px);
  line-height: 0.76;
  font-weight: 500;
  letter-spacing: -0.06em;
  /* Nothing shows below the horizon: the digits rise out of it. */
  clip-path: inset(-40% -10% 0 -10%);

  span[aria-hidden] {
    display: inline-block;
    animation: ${rise} 1100ms var(--ease-out) both;
    animation-delay: calc(var(--d, 0) * 110ms + 260ms);
  }

  @media (prefers-reduced-motion: reduce) {
    span[aria-hidden] {
      animation: none;
    }
  }
`

const Eyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
`

const Title = styled.h1<{ $display?: boolean }>`
  margin: 0;
  max-width: 22ch;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: ${({ $display }) =>
    $display ? 'var(--fs-display)' : 'clamp(24px, 1vw + 18px, 30px)'};
  line-height: ${({ $display }) => ($display ? 'var(--lh-display)' : '1.15')};
  font-weight: 500;
  letter-spacing: -0.03em;
  text-wrap: balance;
`

const Message = styled.p`
  margin: 0;
  max-width: 52ch;
  color: var(--color-muted);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  overflow-wrap: anywhere;
  text-wrap: pretty;
`

const Tip = styled.p`
  margin: 0;
  max-width: 52ch;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Path = styled.code`
  display: inline-block;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-raised);
  box-shadow: inset 0 0 0 1px var(--glass-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Unseen = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const Action = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 14px;

  a svg {
    transform: rotate(-90deg);
    transition: transform 240ms var(--ease-out);
  }

  a:hover svg {
    transform: rotate(-90deg) translateY(2px);
  }
`

interface ErrorPageProps {
  code?: string | null
  title?: string | null
  message?: string | null
  tip?: string | React.ReactNode | null
  /** Runs before the way home navigates (e.g. to reset a crashed view). */
  onHome?: () => void
  /** A failed read that may answer now: offers "Try again" beside home. */
  onRetry?: () => void
}

/** "noindex" while a 4xx page is shown; the previous value comes back after. */
const useNoIndex = (active: boolean) => {
  useEffect(() => {
    if (!active) return
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const previous = meta?.getAttribute('content') ?? null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      document.head.append(meta)
    }
    meta.setAttribute('content', 'noindex')
    const node = meta
    return () => {
      if (previous === null) node.remove()
      else node.setAttribute('content', previous)
    }
  }, [active])
}

/**
 * Measures what sits above the stage and the footer below it, so the stage
 * can fill the rest of the viewport exactly; follows resizes.
 */
const useFitViewport = () => {
  const stage = useRef<HTMLElement>(null)
  const [fit, setFit] = useState<{ above: number; below: number }>()
  useLayoutEffect(() => {
    const node = stage.current
    if (!node) return
    const footer = document.querySelector('footer')
    const read = () => {
      const above = Math.round(
        node.getBoundingClientRect().top + window.scrollY,
      )
      const below =
        footer && !node.contains(footer)
          ? Math.ceil(footer.getBoundingClientRect().height)
          : 0
      setFit((previous) =>
        previous?.above === above && previous.below === below
          ? previous
          : { above, below },
      )
    }
    read()
    window.addEventListener('resize', read)
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(read)
    // The footer stacks on phones; a banner can appear above the app bar.
    if (footer) observer?.observe(footer)
    observer?.observe(document.body)
    return () => {
      window.removeEventListener('resize', read)
      observer?.disconnect()
    }
  }, [])
  const style = fit
    ? ({
        '--above': `${fit.above}px`,
        '--below': `${fit.below}px`,
      } as React.CSSProperties)
    : undefined
  return [stage, style] as const
}

const ErrorPage = ({
  code,
  title,
  message,
  tip,
  onHome,
  onRetry,
}: ErrorPageProps) => {
  const [stageRef, stageStyle] = useFitViewport()
  // Set only when this page is an error boundary's fallback.
  const boundary = useContext(ErrorBoundaryContext)
  const goHome =
    onHome ?? (boundary?.didCatch ? () => boundary.resetErrorBoundary() : null)
  // Only a plain click navigates here; a new tab leaves this view as it is.
  const handleHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      !goHome ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    goHome()
  }

  const shownCode = code || '404'
  const notFound = shownCode === '404'
  const numeric = /^\d{3}$/.test(shownCode)
  const heading =
    title || (notFound ? 'Page not found' : 'Something went wrong')
  // The 404 heading already says it; only a caller's own message adds news.
  const body = message || null
  const path =
    notFound && typeof window !== 'undefined' ? window.location.pathname : null

  useDocumentHead(`${heading} · Kleros Curate`)
  useNoIndex(/^4\d\d$/.test(shownCode))

  // Under a numeric code the words follow the digits as they rise.
  let index = numeric ? 4 : 0
  const next = () => ({ ['--i' as string]: index++ })

  return (
    <Stage ref={stageRef} style={stageStyle}>
      <Moment>
        {numeric ? (
          <CodeStage data-digits>
            <Dawn aria-hidden />
            <Code>
              <Unseen>Error {shownCode}</Unseen>
              {shownCode.split('').map((digit, position) => (
                <span
                  key={position}
                  aria-hidden
                  style={{ ['--d' as string]: position }}
                >
                  {digit}
                </span>
              ))}
            </Code>
            <Horizon aria-hidden />
          </CodeStage>
        ) : (
          <Eyebrow style={next()}>
            <StatusDot $tone="contested" aria-hidden />
            <Label $tone="text">{shownCode}</Label>
          </Eyebrow>
        )}
        {numeric ? (
          <Title style={next()}>{heading}</Title>
        ) : (
          <CodeStage style={next()}>
            <Dawn aria-hidden />
            <Title $display>{heading}</Title>
            <Horizon $gap aria-hidden />
          </CodeStage>
        )}
        {body && <Message style={next()}>{body}</Message>}
        {path && path !== '/' && (
          <Path title={path} style={next()}>
            {path}
          </Path>
        )}
        {tip && <Tip style={next()}>{tip}</Tip>}
        <Action style={next()}>
          {onRetry && (
            <Button type="button" $variant="primary" onClick={onRetry}>
              Try again
            </Button>
          )}
          <ButtonLink
            to="/"
            $variant={onRetry ? 'secondary' : 'primary'}
            onClick={handleHome}
          >
            Go to the dashboard
            <CurateIcon name="chevron-down" size={15} />
          </ButtonLink>
        </Action>
      </Moment>
    </Stage>
  )
}

export default ErrorPage
