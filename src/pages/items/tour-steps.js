import React from 'react'

const itemsTourSteps = [
  {
    selector: `#tcr-info-column`,
    content: () => (
      <div>
        Let's take a quick tour of the items view.{' '}
        <span role="img" aria-label="bus">
          🚎
        </span>
        <br />
        <br />
        Here, you can view information of the current list you are viewing. This
        gives you context on what each item is.
      </div>
    )
  },
  {
    selector: `#submit-item-button`,
    content: `To submit an item to the list, click this button.`
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
        Policies. If you submit a non-compliant list, it will be challenged and
        you will lose your deposit.
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
        Use this bar to search for lists submitted by users.
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
    content: `The items of this list can be on the state "Submitted", "Registered", "Challenged" or "Rejected".`
  }
]

export default itemsTourSteps
