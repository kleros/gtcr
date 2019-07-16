import { Card, Button } from 'antd'
import PropTypes from 'prop-types'
import React, { useContext } from 'react'
import { WalletContext } from '../../bootstrap/wallet-context'

const Deploy = ({ resetTcrState }) => {
  const { setPendingCallback } = useContext(WalletContext)
  const onDeploy = () => {
    setPendingCallback(() => {
      console.info('deploy contracts')
      resetTcrState()
    })
  }

  return (
    <Card title="Deploy the TCR">
      <Button type="primary" onClick={onDeploy}>
        Deploy!
      </Button>
    </Card>
  )
}

Deploy.propTypes = {
  resetTcrState: PropTypes.func.isRequired
}

export default Deploy
