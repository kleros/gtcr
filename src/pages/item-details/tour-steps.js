import { capitalizeFirstLetter } from 'utils/string'

const itemTourSteps = metadata => {
  const { itemName, itemNamePlural } = metadata || {}

  return [
    {
      content: `The ${(itemName && itemName.toLowerCase()) ||
        'item'} details view displays some key information about a specific ${(itemName &&
        itemName.toLowerCase()) ||
        'item'}.`
    },
    {
      selector: `#item-status-card`,
      content: `Here you can find information about the current status of the ${(itemName &&
        itemName.toLowerCase()) ||
        'item'} and the challenge bounty among others.`
    },
    {
      selector: `#item-action-button`,
      content: `Here you will find available actions for the ${(itemName &&
        itemName.toLowerCase()) ||
        'item'}. ${(itemNamePlural && capitalizeFirstLetter(itemNamePlural)) ||
        'Items'} can be submitted, removed or challenged depending on their status.`
    },
    {
      selector: `#item-details-card`,
      content: `This is the ${(itemName && itemName.toLowerCase()) ||
        'item'} details card. These are important fields to check against the listing criteria of this list.`
    },
    {
      selector: `#request-timelines`,
      content: `This is the ${(itemName && itemName.toLowerCase()) ||
        'item'} history card. Here you will find important information of ongoing submissions and removal requests such as rulings, evidence and appeals. If there is a dispute, this is also where you will submit evidence.`
    },
    {
      selector: `#badges`,
      content: `This is the badges section. Badges are an easy way to see if the ${(itemName &&
        itemName.toLowerCase()) ||
        'item'} is present on another list, or to submit it.`
    }
  ]
}

export default itemTourSteps
