import { List, Popover } from 'antd'
import ETHAddress from './eth-address'
import ETHAmount from './eth-amount'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import ReactBlockies from 'react-blockies'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'

const StyledDiv = styled.div`
  height: 32px;
  line-height: 100%;
  width: 32px;
`
const StyledReactBlockies = styled(ReactBlockies)`
  border-radius: ${({ large }) => (large ? '4' : '16')}px;
`
const Identicon = ({ className, large }) => {
  const { account, library } = useWeb3Context()
  const [balance, setBalance] = useState()
  useEffect(() => {
    ;(async () => {
      setBalance(await library.getBalance(account))
    })()
  }, [library, account])

  const content = (
    <StyledDiv className={className}>
      <StyledReactBlockies
        large={large}
        scale={large ? 7 : 4}
        seed={account.toLowerCase()}
        size={large ? 14 : 8}
      />
    </StyledDiv>
  )

  return large ? (
    content
  ) : (
    <Popover
      arrowPointAtCenter
      content={
        <List>
          <List.Item>
            <List.Item.Meta
              description={<ETHAddress address={account} />}
              title="Address"
            />
          </List.Item>
          {account && (
            <List.Item>
              <List.Item.Meta
                description={<ETHAmount amount={balance} decimals={4} />}
                title="ETH"
              />
            </List.Item>
          )}
        </List>
      }
      placement="bottomRight"
      title="Account"
      trigger="click"
    >
      {content}
    </Popover>
  )
}

Identicon.propTypes = {
  className: PropTypes.string,
  large: PropTypes.bool
}

Identicon.defaultProps = {
  className: null,
  large: false
}

export default Identicon
