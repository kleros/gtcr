import React from 'react'
import { capitalizeFirstLetter, getArticleFor } from '../../utils/string'

const itemsTourSteps = metadata => {
  const { tcrTitle, itemName, itemNamePlural } = metadata || {}
  return [
    {
      selector: `#tcr-info-column`,
      content: () => (
        <div>
          Let's take a quick tour of the list view.{' '}
          <span role="img" aria-label="bus">
            🚎
          </span>
          <br />
          <br />
          Here, you can view information of the current list. This gives you
          context on what each item is.{' '}
          {metadata &&
            `In the case of ${tcrTitle}, each item is ${getArticleFor(
              itemName
            )} ${itemName.toLowerCase()}`}
          .
        </div>
      )
    },
    {
      selector: `#submit-item-button`,
      content: `To submit ${
        itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'item'
      } to ${tcrTitle || 'the list'}, click this button.`
    },
    {
      selector: `#policy-link`,
      content: () => (
        <div>
          Here you can find the listing policy for this list.{' '}
          <span role="img" aria-label="policy">
            📜
          </span>
          <br />
          <br />
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          Before making your submission, make sure it complies with the Listing
          Policies. If you submit a non-compliant{' '}
          {itemName.toLowerCase() || 'item'}, it will be challenged and you will
          lose your deposit.
          <span role="img" aria-label="warning">
            ⚠️
          </span>
        </div>
      )
    },
    {
      selector: `#items-search-bar`,
      content: () => (
        <div>
          Use this bar to search for{' '}
          {itemName
            ? (itemNamePlural && itemNamePlural.toLowerCase()) ||
              `${itemName.toLowerCase()}s`
            : 'items'}{' '}
          submitted by users.
          <span role="img" aria-label="magnifying-glass">
            🔍
          </span>
        </div>
      )
    },
    {
      selector: `#items-filters`,
      content: () => (
        <div>
          The filtering options will allow you to fine tune your search.{' '}
          <span role="img" aria-label="microscope">
            🔬
          </span>
        </div>
      )
    },
    {
      selector: `#items-grid-view`,
      content: `${
        itemName
          ? capitalizeFirstLetter(itemNamePlural) ||
            `${capitalizeFirstLetter(itemName)}s`
          : 'items'
      } in the "Submitted" and "Removal Requested" state can be challenged to potentially earn rewards.`
    }
  ]
}

export default itemsTourSteps
