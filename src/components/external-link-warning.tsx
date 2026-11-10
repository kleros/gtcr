import React from 'react'
import styled from 'styled-components'
import { Modal } from 'components/ui'
import { CurateIcon } from 'components/curate/icons'
import { Button, Label, StatusDot } from 'components/curate/primitives'

/*
 * Confirmation before leaving for an external site. The destination leads:
 * its domain as the one large line, then the exact address in mono with the
 * domain lifted out of it, so a misspelt or look-alike domain is easy to see
 * before anything opens.
 */

const Destination = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`

const Host = styled.div`
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 1.2vw + 18px, 30px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
`

const Well = styled.code`
  display: block;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--color-raised);
  box-shadow: inset 0 0 0 1px var(--glass-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-data);
  line-height: var(--lh-data);
  overflow-wrap: anywhere;

  b {
    color: var(--color-text);
    font-weight: 500;
  }

  i {
    color: var(--color-faint);
    font-style: normal;
  }
`

const Hint = styled.p`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 18px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  > span:first-child {
    transform: translateY(-1px);
  }
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;

  @media (max-width: 480px) {
    > button {
      flex: 1 1 auto;
    }
  }
`

/** Splits a URL into what the browser will open: scheme, host, the rest. */
const parts = (url: string) => {
  try {
    const parsed = new URL(url.trim())
    return {
      scheme: `${parsed.protocol}//`,
      host: parsed.host,
      rest: `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`,
    }
  } catch {
    return null
  }
}

interface ExternalLinkWarningProps {
  visible: boolean
  url: string
  onConfirm: () => void
  onCancel: () => void
}

const ExternalLinkWarning = ({
  visible,
  url,
  onConfirm,
  onCancel,
}: ExternalLinkWarningProps) => {
  const split = parts(url)
  return (
    <Modal
      visible={visible}
      title="Leaving Kleros Curate"
      onCancel={onCancel}
      width={480}
      centered
      footer={
        <Actions>
          <Button
            type="button"
            $variant="secondary"
            $size="sm"
            onClick={onCancel}
          >
            Stay here
          </Button>
          <Button
            type="button"
            $variant="primary"
            $size="sm"
            onClick={onConfirm}
          >
            Open site
            <CurateIcon name="external" size={14} />
          </Button>
        </Actions>
      }
    >
      <Destination>
        <Label $tone="faint">You are opening</Label>
        <Host>{split?.host || url}</Host>
        <Well>
          {split ? (
            <>
              <i>{split.scheme}</i>
              <b>{split.host}</b>
              {split.rest}
            </>
          ) : (
            url
          )}
        </Well>
      </Destination>
      <Hint>
        <StatusDot $tone="contested" aria-hidden />
        <span>
          Check the domain letter by letter and open it only if you trust it.
        </span>
      </Hint>
    </Modal>
  )
}

export default ExternalLinkWarning
