// Takes the lower limit from an array of integers compared to some input.
// This is used to select which metadata to use for an item based on
// the its blocknumber or timestamp and the block number or timestamp
// of the metaevidence used on when it was first submitted.
const takeLower = (
  list: (number | string)[],
  limit: number | string,
): number => {
  const numList = list.map((item) => Number(item))
  const numLimit = Number(limit)
  let result = numList[0]

  for (let i = 0; i < numList.length; i++)
    if (numList[i] > numLimit) {
      result = numList[i - 1]
      break
    }

  return result
}

export default takeLower
