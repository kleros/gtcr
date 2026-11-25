import React from 'react'
import { useParams } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { parseIpfs } from 'utils/ipfs-parse'

interface ListingCriteriaLinkProps {
  fileURI: string | undefined | null
  /** The list whose policy this is; by default the list in the URL. */
  tcrAddress?: string
  /** That list's chain; by default the chain in the URL. */
  chainId?: number | string
  className?: string
  children: React.ReactNode
}

/**
 * Opens a list's policy in the app's viewer, in a new tab. Only the list and
 * entry pages render the viewer (the submit page and the factories do not),
 * so the link names the list's own page, whichever page it is on. Where no
 * list is known, it opens the file itself.
 */
const ListingCriteriaLink = ({
  fileURI,
  tcrAddress,
  chainId,
  className,
  children,
}: ListingCriteriaLinkProps) => {
  const params = useParams<{ tcrAddress: string }>()
  const urlChainId = useUrlChainId()
  const list = tcrAddress ?? params.tcrAddress
  const chain = chainId ?? urlChainId
  const file = parseIpfs(fileURI || '')
  const href =
    list && chain
      ? `/tcr/${chain}/${list}?attachment=${encodeURIComponent(file)}&isPolicy=true`
      : file

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

export default ListingCriteriaLink
