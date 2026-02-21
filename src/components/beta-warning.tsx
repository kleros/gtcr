import React, { useEffect, useState, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Alert } from 'components/ui'
import localforage from 'localforage'

const BETA_WARNING_DISMISSED = 'BETA_WARNING_DISMISSED'

const BannerContainer = styled.div`
  background-color: ${({ theme }) => theme.betaWarningBg};
  z-index: 1000;
  padding: 0 8%;

  ${smallScreenStyle(
    () => css`
      padding: 0;
    `,
  )}
`

const BannerText = (
  <div>
    Warning: This is beta software. There is{' '}
    <a href="https://web.solidified.io/contract/5ed7efb180cc4000110f6371">
      a bug bounty on Curate.
    </a>{' '}
    Participate for a chance to win up to 100 ETH.
  </div>
)

const WarningBanner = () => {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    ;(async () => {
      const wasDismissed =
        (await localforage.getItem(BETA_WARNING_DISMISSED)) || false
      setDismissed(wasDismissed)
    })()
  }, [])
  const onClose = useCallback(
    () => localforage.setItem(BETA_WARNING_DISMISSED, true),
    [],
  )

  if (dismissed !== false) return <div />

  return (
    <BannerContainer>
      <Alert
        message={BannerText}
        banner
        closable
        onClose={onClose}
        closeText="Don't show again"
      />
    </BannerContainer>
  )
}

export default WarningBanner
