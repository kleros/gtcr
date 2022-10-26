// i don't want to have to import lodash just for this

const objectWithoutKey = (object, key) => {
  // eslint-disable-next-line no-unused-vars
  const { [key]: nothing, ...otherKeys } = object
  return otherKeys
}

export default objectWithoutKey
