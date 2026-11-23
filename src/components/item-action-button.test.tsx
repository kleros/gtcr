import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from 'test/render'
import { STATUS_CODE } from 'utils/item-status'
import ItemActionButton from './item-action-button'

/*
 * An entry page draws its action twice: in the card, and in the sticky
 * action bar (item-standard-action-bar.tsx) that keeps it in reach. The two
 * buttons must not share an id (an id is unique to a page), and the card's
 * keeps the one the bar looks for inside the card.
 */
const Page = ({ statusCode }: { statusCode?: number }) => (
  <>
    <div id="item-status-card">
      <ItemActionButton
        statusCode={statusCode}
        itemName="token"
        itemID="0x01"
      />
    </div>
    <div role="region" aria-label="Entry actions">
      <ItemActionButton
        id="item-action-button-mobile"
        statusCode={statusCode}
        itemName="token"
        itemID="0x01"
      />
    </div>
  </>
)

const duplicateIds = () => {
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  return ids.filter((id, index) => ids.indexOf(id) !== index)
}

describe('ItemActionButton', () => {
  it('gives the bar’s copy of the action an id of its own', () => {
    renderWithProviders(<Page statusCode={STATUS_CODE.REGISTERED} />)
    expect(
      screen.getAllByRole('button', { name: /Remove token/ }),
    ).toHaveLength(2)
    expect(duplicateIds()).toEqual([])
    expect(
      document.querySelector('#item-status-card #item-action-button'),
    ).toHaveTextContent('Remove token')
  })

  it('keeps the ids apart while the entry loads', () => {
    renderWithProviders(<Page />)
    expect(screen.getAllByRole('button', { name: 'Loading…' })).toHaveLength(2)
    expect(duplicateIds()).toEqual([])
  })
})
