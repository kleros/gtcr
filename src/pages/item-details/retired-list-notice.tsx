import React from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import { replacedListOfLists } from 'config/list-of-lists'
import { Notice } from 'components/curate/item-light-notice'

/*
 * Kleros' retired Classic lists of lists still take submissions, but a list
 * registered on one is not Kleros Verified. Their entry pages and submit
 * dialog say so before a deposit is sent, in the words of the list's own
 * page (pages/items), with a link to the list of lists that replaced them.
 * Any other list renders nothing.
 */

const SuccessorLink = styled(Link)`
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

export const RetiredListNotice = ({
  chainId,
  tcrAddress,
}: {
  chainId?: number | null
  tcrAddress?: string | null
}) => {
  const replacement = replacedListOfLists(chainId, tcrAddress)
  if (!replacement) return null
  return (
    <Notice>
      Kleros no longer uses this list of lists: new lists go to{' '}
      <SuccessorLink to={`/tcr/${chainId}/${replacement}`}>
        the current one
      </SuccessorLink>
      , and only the lists registered there are Kleros Verified.
    </Notice>
  )
}

export default RetiredListNotice
