export const truncateETHAddress = ethAddr =>
  `${ethAddr.slice(0, 5)}...${ethAddr.slice(40)}`

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

export const sanitize = str =>
  str
    .toString()
    .toLowerCase()
    .replace(/([^a-z0-9.]+)/gi, '-') // Only allow numbers and aplhanumeric.

export const LOREM_IPSUM = `Natus ipsam unde et accusamus. Autem et laboriosam non harum voluptas necessitatibus commodi. Enim suscipit cumque aut voluptas quibusdam soluta quis. Velit modi dolores voluptate pariatur. Eligendi veniam aut esse. Aut nam itaque repellendus explicabo dolores.

Voluptates magnam error sequi occaecati facere. Et quos et debitis sit autem laboriosam consequuntur distinctio. Iure repudiandae aliquam corrupti corrupti odio nihil necessitatibus. Quam beatae placeat ut nulla provident earum beatae ipsum.

Blanditiis dolor laudantium quo totam. Voluptate rerum qui qui dolor. Debitis occaecati sed distinctio molestias voluptatem nisi eveniet.`

export const isVowel = x => /[aeiouAEIOU]/.test(x)
