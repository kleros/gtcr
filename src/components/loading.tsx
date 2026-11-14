import React from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * Loading: the Curate mark breathing in a soft pool of light, centred in the
 * space the page will take. It waits 240ms before it shows, so fast loads
 * never flash it. Reduced motion holds it still.
 */

/* The hexagon of the Curate wordmark (its first 37 of 130 units). */
const MARK =
  'M35.1962 30.5049L19.0499 39.8152C18.6226 40.0616 18.0962 40.0616 17.6689 39.8152L1.52256 30.5049C1.09526 30.2585 0.832031 29.8031 0.832031 29.3103V10.6897C0.832031 10.1969 1.09526 9.74153 1.52256 9.49514L17.6689 0.184793C18.0962 -0.0615975 18.6226 -0.0615975 19.0499 0.184793L35.1962 9.49514C35.6235 9.74153 35.8868 10.1969 35.8868 10.6897V29.3103C35.8868 29.8031 35.6235 30.2585 35.1962 30.5049ZM6.8216 26.6078L2.21308 29.267V10.6897L2.23804 10.6753L6.80026 13.4251L6.90781 13.2467L2.44429 10.5563L18.3123 1.40645L18.3123 6.63718L18.5207 6.63718L18.5207 1.4723L34.4112 10.6352L29.7383 13.3319L29.8424 13.5124L34.5057 10.8212V29.1742L29.8622 26.4545L29.757 26.6342L34.4151 29.3626L18.5596 38.5052L18.5596 33.1215H18.3512L18.3513 38.616L2.38397 29.4089L6.92572 26.7882L6.8216 26.6078ZM24.2135 11.8845L13.8635 11.4274L7.81959 18.8649L12.0858 28.8314L22.4921 29.4898L28.4038 21.083L24.2135 11.8845ZM15.0741 28.5395L20.5563 27.1265L21.5211 28.9466L15.0741 28.5395ZM21.6488 26.6504L26.4476 23.125L22.6023 28.4881L21.6488 26.6504ZM12.6892 27.7547L12.5319 21.5521L19.0322 26.1295L12.6892 27.7547ZM11.4924 26.5255L8.50119 19.5763L11.3679 20.1748L11.4924 26.5255ZM21.7145 25.2051L22.8836 16.6813L27.3132 21.114L21.7145 25.2051ZM13.9305 20.0233L21.4147 16.7987L20.329 24.9019L13.9305 20.0233ZM8.68697 18.5365L12.9542 13.2229L11.5399 19.1325L8.68697 18.5365ZM23.2456 15.1402L24.1777 13.2533L26.715 18.6179L23.2456 15.1402ZM13.3107 17.9829L14.5671 12.6432L20.5482 15.1828L13.3107 17.9829ZM21.9495 14.2741L16.9242 12.1064L23.0164 12.3503L21.9495 14.2741Z'

const appear = keyframes`
  from { opacity: 0; transform: scale(0.92); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: none; }
`

const breathe = keyframes`
  0%, 100% { opacity: 0.5; transform: scale(0.97); }
  50% { opacity: 1; transform: scale(1); }
`

const bloom = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 0.8; transform: scale(1.05); }
`

const LoadingWrapper = styled.div`
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: min(64vh, 560px);
  padding: 24px 0;
`

const Mark = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  animation: ${appear} 520ms var(--ease-out) 240ms both;

  /* The pool of light the mark breathes in. */
  &::before {
    content: '';
    position: absolute;
    inset: -12px;
    border-radius: 50%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--aurora-b) 38%, transparent),
      color-mix(in srgb, var(--color-primary) 12%, transparent) 55%,
      transparent
    );
    animation: ${bloom} 1800ms var(--ease-in-out) infinite;
  }

  svg {
    position: relative;
    width: 40px;
    height: auto;
    color: var(--color-text);
    filter: drop-shadow(
      0 0 14px color-mix(in srgb, var(--aurora-b) 55%, transparent)
    );
    animation: ${breathe} 1800ms var(--ease-in-out) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;

    &::before,
    svg {
      animation: none;
      opacity: 1;
    }
  }
`

const Unseen = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const Loading = () => (
  <LoadingWrapper role="status" aria-live="polite">
    <Mark aria-hidden="true">
      <svg viewBox="0 -0.2 36.8 40.4" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={MARK}
          fill="currentColor"
        />
      </svg>
    </Mark>
    <Unseen>Loading</Unseen>
  </LoadingWrapper>
)

export default Loading
