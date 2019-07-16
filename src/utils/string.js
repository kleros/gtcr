export const truncateETHAddress = ethAddr =>
  `${ethAddr.slice(0, 5)}...${ethAddr.slice(40)}`
