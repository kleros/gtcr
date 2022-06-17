import { Typography } from 'antd'
import React from 'react'

const LongText = ({ value }) => {
  if (!value) return <span style={{ color: 'gray' }}>empty</span>

  return <Typography.Paragraph>{value}</Typography.Paragraph>
}

export default LongText
