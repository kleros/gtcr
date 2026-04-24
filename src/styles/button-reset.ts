import { css } from 'styled-components'

/**
 * Neutralizes native `<button>` styling so a `styled.button` can visually
 * behave like an anchor or plain text. Used across the file-viewer /
 * attachment-display surface where we converted link-styled anchors to
 * buttons so they drive the in-app viewer via `useAttachment` instead of
 * navigating to a new tab.
 */
export const buttonReset = css`
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
`
