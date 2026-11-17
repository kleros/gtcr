import React from 'react'
import { Link } from 'react-router-dom'
import { succeededListOfLists } from 'config/list-of-lists'
import { Notice } from './item-standard-notice'

/*
 * On a former Kleros list of lists (config/list-of-lists.ts), its page and
 * its submit page: the list still works on chain, but registering a list on
 * it no longer makes that list Kleros Verified. Says so, and links the list
 * of lists that replaced it. Nothing on any other list.
 */
const FormerListOfListsNotice = ({
  chainId,
  address,
  submit = false,
}: {
  chainId?: number | null
  address?: string | null
  /** On the submit page: links the successor's submit page. */
  submit?: boolean
}) => {
  const successor = succeededListOfLists(chainId, address)
  if (!successor || !chainId) return null
  const href = `/tcr/${chainId}/${successor}${submit ? '/submit' : ''}`
  return (
    <Notice tone="contested">
      Kleros replaced this list of lists on 17 Nov 2026. A list registered here
      is no longer Kleros Verified:{' '}
      <Link to={href}>
        {submit ? 'submit it to the current one' : 'see the current one'}
      </Link>
      .
    </Notice>
  )
}

export default FormerListOfListsNotice
