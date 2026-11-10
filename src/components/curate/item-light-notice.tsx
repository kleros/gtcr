import React from 'react'
import styled from 'styled-components'
import { Label, StatusDot, type StatusTone } from './primitives'

/*
 * A short inline notice (warnings, prompts): a raised fill, a haloed status
 * dot and plain text. Never color alone.
 */

const Shell = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  > span:first-child {
    margin-top: 5px;
  }
`

const Text = styled.div`
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
`

export const Notice = ({
  tone = 'neutral',
  children,
  role,
}: {
  tone?: StatusTone
  children: React.ReactNode
  role?: 'status' | 'alert'
}) => (
  <Shell role={role}>
    <StatusDot $tone={tone} aria-hidden />
    <Text>{children}</Text>
  </Shell>
)

/** Mono form label built on the Label primitive (uppercase stays inside it). */
export const FieldLabel = styled(Label).attrs({ as: 'label' })<{
  htmlFor?: string
}>`
  cursor: default;
`

/** Inline form error text in the danger role. */
export const FieldError = styled.span`
  display: block;
  color: var(--color-danger);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

export default Notice
