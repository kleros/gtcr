import { createGlobalStyle, keyframes } from 'styled-components'

/*
 * Notifications (the react-toastify toasts the app raises for transactions,
 * uploads and errors) in the v2 language: the stock icon becomes a status
 * dot with a halo in the toast's role colour (info = in progress, success =
 * done, warning, error), pending toasts pulse like any live state, the timer
 * is a 2px hairline in the same colour, and the close button is a ghost
 * circle. The surface itself (fill, hairline, radius) comes from
 * global-styles.
 */

const live = keyframes`
  0% { transform: scale(0.8); opacity: 0.6; }
  70%, 100% { transform: scale(2.6); opacity: 0; }
`

const enter = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.98); filter: blur(4px); }
  to { opacity: 1; transform: none; filter: none; }
`

export const NotificationStyles = createGlobalStyle`
  .Toastify__toast-container .Toastify__toast {
    --cv-toast-tone: var(--status-neutral);
    /* Dot, first line of text and close button share one top line. */
    align-items: flex-start;
    gap: 12px;
    min-height: 0;
    padding: 16px 12px 18px 16px;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 400;
  }

  .Toastify__toast-container .Toastify__toast--info {
    --cv-toast-tone: var(--status-window);
  }

  .Toastify__toast-container .Toastify__toast--success {
    --cv-toast-tone: var(--status-registered);
  }

  .Toastify__toast-container .Toastify__toast--warning {
    --cv-toast-tone: var(--status-contested);
  }

  .Toastify__toast-container .Toastify__toast--error {
    --cv-toast-tone: var(--status-off);
  }

  .Toastify__toast-container .Toastify__toast a {
    color: var(--color-primary);
    font-weight: 500;
    text-underline-offset: 3px;
  }

  /* The icon slot holds a haloed dot in the toast's role colour. */
  .Toastify__toast-container .Toastify__toast-icon {
    position: relative;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin: 0;
    animation: ${enter} 420ms var(--ease-out) both;
  }

  .Toastify__toast-container .Toastify__toast-icon > * {
    display: none;
  }

  .Toastify__toast-container .Toastify__toast-icon::before,
  .Toastify__toast-container .Toastify__toast-icon::after {
    content: '';
    grid-area: 1 / 1;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--cv-toast-tone);
  }

  .Toastify__toast-container .Toastify__toast-icon::before {
    position: relative;
    z-index: 1;
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--cv-toast-tone) 22%, transparent),
      0 0 12px color-mix(in srgb, var(--cv-toast-tone) 70%, transparent);
  }

  .Toastify__toast-container .Toastify__toast-icon::after {
    opacity: 0;
  }

  /* In progress (info or loading): the dot breathes like any live state. */
  .Toastify__toast-container .Toastify__toast--info .Toastify__toast-icon::after,
  .Toastify__toast-container .Toastify__toast-icon:has(.Toastify__spinner)::after {
    animation: ${live} 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  /* The timer: a 2px hairline in the role colour along the bottom edge. */
  .Toastify__toast-container .Toastify__progress-bar--wrp {
    left: 16px;
    right: 16px;
    bottom: 6px;
    width: auto;
    height: 2px;
    border-radius: var(--radius-pill);
  }

  .Toastify__toast-container .Toastify__progress-bar--bg {
    background: var(--glass-border);
    opacity: 1;
  }

  .Toastify__toast-container .Toastify__progress-bar {
    border-radius: var(--radius-pill);
    background: var(--cv-toast-tone);
    box-shadow: 0 0 8px color-mix(in srgb, var(--cv-toast-tone) 60%, transparent);
    opacity: 1;
  }

  /* Close: a ghost circle, quiet until hovered. */
  .Toastify__toast-container .Toastify__close-button {
    position: relative;
    top: auto;
    right: auto;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    margin: -3px -2px -3px auto;
    border-radius: var(--radius-pill);
    color: var(--color-faint);
    opacity: 1;
    transition:
      background var(--motion),
      color var(--motion);
  }

  .Toastify__toast-container .Toastify__close-button > svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  .Toastify__toast-container .Toastify__close-button:hover,
  .Toastify__toast-container .Toastify__close-button:focus-visible {
    background: var(--color-raised);
    color: var(--color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .Toastify__toast-container .Toastify__toast-icon,
    .Toastify__toast-container .Toastify__toast-icon::after {
      animation: none;
    }
  }
`

export default NotificationStyles
