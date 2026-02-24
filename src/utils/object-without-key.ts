const objectWithoutKey = <T extends Record<string, any>>(
  object: T,
  key: string,
): Omit<T, typeof key> => {
  const { [key]: _nothing, ...otherKeys } = object
  return otherKeys
}

export default objectWithoutKey
