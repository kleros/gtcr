const suffixes = ['th', 'st', 'nd', 'rd']

const toOrdinal = (n: number): string => {
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

export default toOrdinal
