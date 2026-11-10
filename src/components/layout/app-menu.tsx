import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import styled, { css } from 'styled-components'
import { litThumb, recessTrack } from 'components/ui/kit-styles'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Link, useLocation } from 'react-router-dom'
import { preloadFactory } from 'bootstrap/app-router'
import { useLaunchChainId } from './launch-chain'

/*
 * Primary navigation (DESIGN.md, Surfaces and controls): the selector look,
 * a recessed track whose lit glass thumb slides to the current section.
 * Routes outside the four sections (a profile, Curate Pro) light none.
 */
const DesktopNav = styled.nav`
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  ${recessTrack}

  ${smallScreenStyle(
    () => css`
      display: none;
    `,
  )}
`

const Thumb = styled.span`
  position: absolute;
  top: 3px;
  bottom: 3px;
  z-index: -1;
  border-radius: var(--radius-pill);
  ${litThumb}
  transition:
    left 340ms var(--ease-spring),
    width 340ms var(--ease-spring),
    opacity 200ms var(--ease-out);

  &[data-instant] {
    transition: opacity 200ms var(--ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const NavLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  text-decoration: none;
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
  white-space: nowrap;
  transition: color var(--motion);

  &:hover,
  &[aria-current='page'] {
    color: var(--color-text);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
`

const AppMenu = () => {
  const { pathname } = useLocation()
  const launchChainId = useLaunchChainId()
  const nav = useRef<HTMLElement>(null)
  const [thumb, setThumb] = useState<{
    left: number
    width: number
    instant: boolean
  }>()

  const section =
    pathname === '/'
      ? 'dashboard'
      : pathname === '/browse' || pathname.startsWith('/tcr/')
        ? 'browse'
        : pathname.startsWith('/launch') || pathname.startsWith('/factory')
          ? 'launch'
          : pathname === '/guide'
            ? 'guide'
            : null

  const measure = useCallback((instant: boolean) => {
    const current = nav.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    )
    setThumb((previous) =>
      current
        ? {
            left: current.offsetLeft,
            width: current.offsetWidth,
            instant: instant || !previous,
          }
        : previous && { ...previous, instant: true },
    )
  }, [])

  useLayoutEffect(() => measure(false), [measure, section])
  useEffect(() => {
    const node = nav.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure(true))
    observer.observe(node)
    return () => observer.disconnect()
  }, [measure])

  const current = (name: string) => (section === name ? 'page' : undefined)

  return (
    <DesktopNav ref={nav} aria-label="Main">
      {thumb && (
        <Thumb
          aria-hidden
          data-instant={thumb.instant ? '' : undefined}
          style={{
            left: thumb.left,
            width: thumb.width,
            opacity: section ? 1 : 0,
          }}
        />
      )}
      <NavLink to="/" aria-current={current('dashboard')}>
        Dashboard
      </NavLink>
      <NavLink to="/browse" aria-current={current('browse')}>
        Browse
      </NavLink>
      <NavLink
        to={`/launch/${launchChainId}`}
        aria-current={current('launch')}
        onMouseEnter={() => preloadFactory()}
      >
        Launch a list
      </NavLink>
      <NavLink to="/guide" aria-current={current('guide')}>
        Guide
      </NavLink>
    </DesktopNav>
  )
}

export default AppMenu
