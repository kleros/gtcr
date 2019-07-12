import { Card, Button } from 'antd'
import PropTypes from 'prop-types'
import React from 'react'

const Deploy = ({ resetStepper, resetTcrState }) => {
  const onClick = () => {
    resetStepper()
    resetTcrState()
  }

  return (
    <Card title="Deploy the TCR">
      <Button type="primary" onClick={onClick}>
        Deploy!
      </Button>
    </Card>
  )
}

Deploy.propTypes = {
  resetStepper: PropTypes.func.isRequired,
  resetTcrState: PropTypes.func.isRequired
}

export default Deploy
