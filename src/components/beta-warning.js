import React, { useEffect, useState, useCallback } from 'react'
import { Alert } from 'antd'
import localforage from 'localforage'
import TextLoop from 'react-text-loop'
import styled from 'styled-components/macro'
import useWindowDimensions from '../hooks/window-dimensions'

const BETA_WARNING_DISMISSED = 'BETA_WARNING_DISMISSED'

const BannerContainer = styled.div`
  background-color: #fffbe6;
  z-index: 1000;

  @media (min-width: 500px) {
    padding: 0 8%;
  }
`

const BannerText = (
  <TextLoop mask>
    <div>
      Warning: This is beta software. There is{' '}
      <a
        href="https://github.com/kleros/tcr/issues/20"
        target="_blank"
        rel="noopener noreferrer"
      >
        a bug bounty on Curate.
      </a>{' '}
      Participate for a chance to win up to 25 ETH.
    </div>
  </TextLoop>
)

const LoopBannerText = (
  <TextLoop mask interval={5000}>
    <div>Warning: This is beta software.</div>
    <div>Win up to 25 ETH by...</div>
    <div>
      ...participating on the{' '}
      <a
        href="https://github.com/kleros/tcr/issues/20"
        target="_blank"
        rel="noopener noreferrer"
      >
        bug bounty.
      </a>{' '}
    </div>
  </TextLoop>
)

const WarningBanner = () => {
  const [dismissed, setDismissed] = useState()
  const { width } = useWindowDimensions()

  useEffect(() => {
    ;(async () => {
      const wasDismissed =
        (await localforage.getItem(BETA_WARNING_DISMISSED)) || false
      setDismissed(wasDismissed)
    })()
  }, [])
  const onClose = useCallback(
    () => localforage.setItem(BETA_WARNING_DISMISSED, true),
    []
  )

  if (dismissed !== false) return <div />

  return (
    <BannerContainer>
      <Alert
        message={width < 910 ? LoopBannerText : BannerText}
        banner
        closable
        onClose={onClose}
        closeText="Don't show again"
      />
    </BannerContainer>
  )
}

export default WarningBanner
