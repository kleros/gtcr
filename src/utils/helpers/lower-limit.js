// Takes the lower limit from an array of integers compared to some input.
// This is used to select which metadata to use for an item based on
// the its blocknumber or timestamp and the block number or timestamp
// of the metaevidence used on when it was first submitted.
const takeLower = (list, limit) => {
  list = list.map(item => Number(item))
  limit = Number(limit)
  let result = list[0]

  for (let i = 0; i < list.length; i++)
    if (list[i] > limit) {
      result = list[i - 1]
      break
    }

  return result
}

export default takeLower
