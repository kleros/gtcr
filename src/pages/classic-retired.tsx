import React from 'react'
import styled from 'styled-components'
import { getExplorerUrl } from 'config/chains'
import { replacedListOfLists } from 'config/list-of-lists'
import ErrorPage from 'pages/error-page'

/*
 * What a Classic Curate list's address shows (its list, entry and submit
 * pages): Curate no longer has a Classic interface. Classic had no open
 * request left when it was retired (16 Nov 2026) and, on chain, no deposit
 * or appeal reward waiting for anyone, so nothing here needs a button. The
 * contracts and their entries stay on chain; the last interface that could
 * act on them is kleros/gtcr commit 15b0fd4
 * (https://github.com/kleros/gtcr/commit/15b0fd4ade22ac15d0efe7dfbc102d26f1d001b6).
 * The router tells Classic lists apart with one field of the existence
 * check (the indexer's Classic Registry), and reads nothing else of them.
 */
const ExplorerLink = styled.a`
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const ClassicRetired = ({
  chainId,
  tcrAddress,
}: {
  chainId: number
  tcrAddress: string
}) => {
  const replacement = replacedListOfLists(chainId, tcrAddress)
  const explorer = getExplorerUrl(chainId)
  return (
    <ErrorPage
      code="Retired"
      tone="window"
      title="Classic lists are retired"
      message={
        replacement
          ? 'This was Kleros’ list of lists on Classic Curate. Lists now go to the current one, and only the lists registered there are Kleros Verified.'
          : 'This is a Classic Curate list. Curate now runs Standard and Stake lists only; this list, its entries and their history stay on chain.'
      }
      tip={
        <ExplorerLink
          href={`${explorer}/address/${tcrAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          See the contract on the block explorer
        </ExplorerLink>
      }
      home={
        replacement
          ? {
              to: `/tcr/${chainId}/${replacement}`,
              label: 'Go to the current list of lists',
            }
          : { to: '/browse', label: 'Browse lists' }
      }
    />
  )
}

export default ClassicRetired
