import { Card, Button } from 'antd'
import React from 'react'

const Deploy = ({ setStep, setTcrState }) => {
  const onClick = () => {
    setStep(1)
    setTcrState({})
  }

  return (
    <Card title='Deploy the TCR'>
      <Button type='primary' onClick={onClick}>Deploy!</Button>
    </Card>
  )
}

export default Deploy
