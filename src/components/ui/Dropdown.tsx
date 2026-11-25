import React, { useState, useRef, useCallback, useEffect } from 'react'
import styled, { css } from 'styled-components'
import { glassPopover } from './kit-styles'

/*
 * Dropdown, v2: the trigger plus a glass panel (the app bar's menus:
 * translucent, blurred, hairline, as SelectMenu's in primitives.tsx). It
 * fades and rises 4px from the side it opens on, and fades out before it
 * hides. The panel is always the wrapper's last child div, which callers
 * rely on for placement.
 *
 * A click on a link, a button or a menu item inside the panel closes it; a
 * click on a heading or the padding does not. When the panel holds menu
 * items ([role^=menuitem]) the keyboard works as in a menu: ArrowDown,
 * ArrowUp, Enter or Space on the trigger open it on the checked item (or
 * the first), the arrows, Home and End move between items, Escape closes it
 * and returns focus to the trigger, and Tab out of it closes it.
 */
const Wrapper = styled.div`
  display: inline-block;
  position: relative;
`

const placementStyles: Record<string, ReturnType<typeof css>> = {
  bottomLeft: css`
    top: 100%;
    left: 0;
    margin-top: 8px;
  `,
  bottomRight: css`
    top: 100%;
    right: 0;
    margin-top: 8px;
  `,
  bottomCenter: css`
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
  `,
  topLeft: css`
    bottom: 100%;
    left: 0;
    margin-bottom: 8px;
  `,
  topRight: css`
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
  `,
  topCenter: css`
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
  `,
}

const Overlay = styled.div<{ $visible?: boolean; $placement?: string }>`
  position: absolute;
  z-index: 1050;
  min-width: 160px;
  ${glassPopover}
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  scale: ${({ $visible }) => ($visible ? 1 : 0.97)};
  translate: 0
    ${({ $visible, $placement }) =>
      $visible ? '0' : $placement?.startsWith('top') ? '4px' : '-4px'};
  transform-origin: ${({ $placement }) => {
    const vertical = $placement?.startsWith('top') ? 'bottom' : 'top'
    const horizontal = $placement?.endsWith('Right')
      ? 'right'
      : $placement?.endsWith('Center')
        ? 'center'
        : 'left'
    return `${vertical} ${horizontal}`
  }};
  transition: ${({ $visible }) =>
    $visible
      ? 'opacity 160ms var(--ease-out), scale 220ms var(--ease-out), translate 220ms var(--ease-out), visibility 0s'
      : 'opacity 120ms var(--ease-exit), scale 120ms var(--ease-exit), translate 120ms var(--ease-exit), visibility 0s linear 120ms'};
  ${({ $placement }) =>
    placementStyles[$placement || 'bottomLeft'] || placementStyles.bottomLeft}

  @media (prefers-reduced-motion: reduce) {
    scale: 1;
    translate: 0 0;
  }
`

interface DropdownProps {
  overlay?: React.ReactNode
  trigger?: string[]
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  placement?: string
  children?: React.ReactNode
  disabled?: boolean
}

const MENU_ITEM = '[role^="menuitem"]'
const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const ACTION = 'a, button, [role^="menuitem"]'
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]'

const Dropdown: React.FC<DropdownProps> = ({
  overlay,
  trigger = ['hover'],
  visible: controlledVisible,
  onVisibleChange,
  placement = 'bottomLeft',
  children,
  disabled = false,
}) => {
  const [internalVisible, setInternalVisible] = useState(false)
  const isControlled = controlledVisible !== undefined
  const isVisible = isControlled ? controlledVisible : internalVisible
  const wrapperRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when the menu opens from the keyboard: focus its item once shown.
  const focusItemOnOpen = useRef(false)

  const setVisible = useCallback(
    (val: boolean) => {
      if (disabled) return
      if (!isControlled) setInternalVisible(val)
      if (onVisibleChange) onVisibleChange(val)
    },
    [disabled, isControlled, onVisibleChange],
  )

  const menuItems = useCallback(
    () =>
      [
        ...(overlayRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM) ?? []),
      ].filter((item) => !item.matches(':disabled')),
    [],
  )

  /** The trigger: the wrapper's first focusable element outside the panel. */
  const triggerElement = useCallback(
    () =>
      [
        ...(wrapperRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ].find((node) => !overlayRef.current?.contains(node)),
    [],
  )

  const focusCurrentItem = useCallback(() => {
    const items = menuItems()
    const checked = items.find(
      (item) => item.getAttribute('aria-checked') === 'true',
    )
    const target = checked ?? items[0]
    target?.focus()
  }, [menuItems])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trigger.includes('click')) return
      const panel = overlayRef.current
      const target = e.target as Element
      if (panel && panel.contains(target)) {
        const action = target.closest(ACTION)
        if (action && panel.contains(action)) setVisible(false)
        return
      }
      // A click from Enter or Space (detail 0) opens on the current item.
      if (!isVisible && e.detail === 0 && menuItems().length > 0)
        focusItemOnOpen.current = true
      setVisible(!isVisible)
    },
    [trigger, isVisible, setVisible, menuItems],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const panel = overlayRef.current
      const items = menuItems()
      if (!panel || items.length === 0) return
      const inPanel = panel.contains(e.target as Node)
      if (!inPanel) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()
        if (isVisible) focusCurrentItem()
        else {
          focusItemOnOpen.current = true
          setVisible(true)
        }
        return
      }
      const index = items.indexOf(document.activeElement as HTMLElement)
      let next = -1
      if (e.key === 'ArrowDown') next = (index + 1) % items.length
      else if (e.key === 'ArrowUp')
        next = (index - 1 + items.length) % items.length
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = items.length - 1
      if (next === -1) return
      e.preventDefault()
      items[next].focus()
    },
    [isVisible, menuItems, focusCurrentItem, setVisible],
  )

  // Focus leaving the trigger and the panel (Tab out of the menu, say)
  // closes it.
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!isVisible) return
      const next = e.relatedTarget as Node | null
      if (!next || !wrapperRef.current?.contains(next)) setVisible(false)
    },
    [isVisible, setVisible],
  )

  // A press inside the panel keeps focus where it is, so clicking a heading
  // or a row never blurs the menu shut before the click lands.
  const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.target as Element).closest(TEXT_ENTRY)) e.preventDefault()
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (trigger.includes('hover')) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      setVisible(true)
    }
  }, [trigger, setVisible])

  const handleMouseLeave = useCallback(() => {
    if (trigger.includes('hover'))
      hoverTimeoutRef.current = setTimeout(() => {
        setVisible(false)
      }, 100)
  }, [trigger, setVisible])

  // Close on outside click and on Escape
  useEffect(() => {
    if (!isVisible) return undefined

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setVisible(false)
    }
    // Escape belongs to the open menu alone: handled in the capture phase
    // and stopped, so a dialog listening on the document keeps its state.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setVisible(false)
      // Only a menu used from the keyboard takes focus back to its trigger.
      if (wrapperRef.current?.contains(document.activeElement))
        triggerElement()?.focus()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [isVisible, setVisible, triggerElement])

  // Opened from the keyboard: focus the checked item, or the first. Closed
  // while focus is on an item (one was picked): back to the trigger, so
  // focus never stays on a hidden row.
  useEffect(() => {
    if (isVisible) {
      if (focusItemOnOpen.current) focusCurrentItem()
      focusItemOnOpen.current = false
    } else if (overlayRef.current?.contains(document.activeElement))
      triggerElement()?.focus()
  }, [isVisible, focusCurrentItem, triggerElement])

  // Cleanup timeout on unmount
  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    },
    [],
  )

  return (
    <Wrapper
      ref={wrapperRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="ui-dropdown"
    >
      {children}
      <Overlay
        ref={overlayRef}
        className="ui-dropdown-overlay"
        $visible={isVisible}
        $placement={placement}
        aria-hidden={!isVisible}
        onMouseDown={handlePanelMouseDown}
      >
        {overlay}
      </Overlay>
    </Wrapper>
  )
}

export default Dropdown
