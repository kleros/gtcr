import React from 'react'
import ListingCriteriaLink from 'components/listing-criteria-link'
import {
  Button,
  ButtonAnchor,
  type ButtonVariant,
} from 'components/curate/primitives'

/*
 * The list's policy, opened from inside a dialog. It opens in a new tab: the
 * in-app viewer takes over the page, which would close the dialog and lose
 * what was typed in it. Without a policy the button stays, disabled. The
 * viewer opens on the list in the URL unless the dialog names another one
 * (a badge list, or the list of lists from the factory).
 */
export const PolicyButton = ({
  fileURI,
  tcrAddress,
  variant = 'ghost',
  size = 'sm',
  children,
}: {
  fileURI?: string | null
  /** The list the policy belongs to, when it is not the list in the URL. */
  tcrAddress?: string
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  children: React.ReactNode
}) =>
  fileURI ? (
    <ButtonAnchor
      as={ListingCriteriaLink}
      fileURI={fileURI}
      tcrAddress={tcrAddress}
      $variant={variant}
      $size={size}
    >
      {children}
    </ButtonAnchor>
  ) : (
    <Button type="button" $variant={variant} $size={size} disabled>
      {children}
    </Button>
  )

export default PolicyButton
