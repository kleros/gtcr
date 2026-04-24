import React from 'react'
import { parseIpfs } from 'utils/ipfs-parse'

interface ListingCriteriaLinkProps {
  fileURI: string | undefined | null
  className?: string
  children: React.ReactNode
}

const ListingCriteriaLink = ({
  fileURI,
  className,
  children,
}: ListingCriteriaLinkProps) => {
  const href = `?attachment=${encodeURIComponent(
    parseIpfs(fileURI || ''),
  )}&isPolicy=true`

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
