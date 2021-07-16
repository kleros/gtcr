import React, { useEffect, useState, useCallback } from 'react'
import { List, Popover, Form, Input, Button, Alert } from 'antd'
import { withFormik, Field } from 'formik'
import { useWeb3Context } from 'web3-react'
import ReactBlockies from 'react-blockies'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import * as yup from 'yup'
import localforage from 'localforage'
import ETHAddress from './eth-address'
import ETHAmount from './eth-amount'
import { randomBytes, bigNumberify } from 'ethers/utils'
import useNativeCurrency from '../hooks/native-currency'

const StyledDiv = styled.div`
  height: 32px;
  line-height: 100%;
  width: 32px;
`
const StyledReactBlockies = styled(ReactBlockies)`
  border-radius: ${({ large }) => (large ? '4' : '16')}px;
`

const xDaiInfo = {
  name: 'xDAI Chain',
  chainId: 100,
  shortName: 'xdai',
  chain: 'XDAI',
  network: 'mainnet',
  networkId: 100,
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpc: [
    'https://rpc.xdaichain.com',
    'https://xdai.poanetwork.dev',
    'wss://rpc.xdaichain.com/wss',
    'wss://xdai.poanetwork.dev/wss',
    'http://xdai.poanetwork.dev',
    'https://dai.poa.network',
    'ws://xdai.poanetwork.dev:8546'
  ],
  faucets: [],
  explorers: [
    {
      name: 'blockscout',
      url: 'https://blockscout.com/xdai/',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://forum.poa.network/c/xdai-chain'
}

const supportedNetworkURLs = JSON.parse(process.env.REACT_APP_RPC_URLS)
const mainnetInfo = {
  name: 'Ethereum Mainnet',
  chainId: 1,
  shortName: 'eth',
  chain: 'ETH',
  network: 'mainnet',
  networkId: 1,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpc: [supportedNetworkURLs[1]],
  faucets: [],
  explorers: [
    {
      name: 'etherscan',
      url: 'https://etherscan.io',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://ethereum.org'
}

const EmailForm = ({
  formID,

  // Formik bag
  handleSubmit
}) => (
  <Form id={formID} onSubmit={handleSubmit} layout="vertical">
    <Field name="email">
      {({ field, form: { errors, touched } }) => (
        <Form.Item
          help={errors.email && touched.email ? errors.email : ''}
          validateStatus={errors.email && touched.email ? 'error' : undefined}
          hasFeedback
        >
          <Input placeholder="alice@pm.me" {...field} />
        </Form.Item>
      )}
    </Field>
  </Form>
)

EmailForm.propTypes = {
  formID: PropTypes.string.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  initialValues: PropTypes.shape({
    email: PropTypes.string
  })
}

EmailForm.defaultProps = {
  initialValues: null
}

const validationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Invalid email.')
    .required('A valid email is required.')
})

const EnhancedEmailForm = withFormik({
  validationSchema,
  handleSubmit: (values, { props: { onSubmit } }) => {
    onSubmit(values)
  },
  mapPropsToValues: ({ initialValues }) => initialValues
})(EmailForm)

const EMAIL_FORM_ID = 'emailForm'
const CACHED_SETTINGS = 'CACHED_SETTINGS'
const Identicon = ({ className, large }) => {
  const { account, library, networkId } = useWeb3Context()
  const nativeCurrency = useNativeCurrency()
  const [balance, setBalance] = useState()
  const [emailStatus, setEmailStatus] = useState()
  const [fetchedEmailSettings, setFetchedEmailSettings] = useState()
  useEffect(() => {
    ;(async () => {
      setBalance(await library.getBalance(account))
    })()
  }, [library, account])

  // Fetch current email settings from local storage, if available.
  useEffect(() => {
    if (!process.env.REACT_APP_NOTIFICATIONS_API_URL || !account || !networkId)
      return
    ;(async () => {
      const cachedSettings = await localforage.getItem(CACHED_SETTINGS)
      setFetchedEmailSettings(cachedSettings)
    })()
  }, [account, networkId])

  const submitEmail = useCallback(
    ({ email }) => {
      setEmailStatus('loading')
      const data = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'salt', type: 'bytes32' }
          ],
          Settings: [{ name: 'email', type: 'string' }]
        },
        primaryType: 'Settings',
        message: { email },
        domain: {
          name: `${process.env.REACT_APP_NOTIFICATIONS_API_URL}`,
          chainId: networkId,
          version: 1,
          salt: `0x${bigNumberify(randomBytes(32)).toString(16)}`
        }
      }
      try {
        library.provider.sendAsync(
          {
            method: 'personal_sign',
            params: [account, JSON.stringify(data)],
            from: account
          },
          async (err, { result: signature }) => {
            if (err) {
              console.error(err)
              setEmailStatus('error')
              return
            }

            try {
              const response = await (
                await fetch(
                  `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/email-settings`,
                  {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      signature,
                      data
                    })
                  }
                )
              ).json()
              if (response.status === 'success') {
                localforage.setItem(CACHED_SETTINGS, { email })
                setEmailStatus('success')
              } else {
                setEmailStatus('error')
                console.error(response)
              }
            } catch (err_) {
              setEmailStatus('error')
              console.error(err_)
            }
          }
        )
      } catch (err) {
        setEmailStatus('error')
        console.error(err)
      }
    },
    [account, library.provider, networkId]
  )

  const content = (
    <StyledDiv className={className} id="react-blockies-identicon">
      <StyledReactBlockies
        large={large}
        scale={large ? 7 : 4}
        seed={account.toLowerCase()}
        size={large ? 14 : 8}
      />
    </StyledDiv>
  )

  const switchChain = useCallback(() => {
    if (!account) return
    if (networkId === 100)
      library.send('wallet_switchEthereumChain', [
        {
          chainId: `0x${mainnetInfo.chainId.toString(16)}`
        }
      ])
    else
      library.send('wallet_addEthereumChain', [
        {
          chainId: `0x${xDaiInfo.chainId.toString(16)}`,
          nativeCurrency: xDaiInfo.nativeCurrency,
          chainName: xDaiInfo.name,
          rpcUrls: xDaiInfo.rpc,
          blockExplorerUrls: xDaiInfo.explorers.url
        }
      ])
  }, [account, library, networkId])

  return large ? (
    content
  ) : (
    <Popover
      arrowPointAtCenter
      content={
        <List>
          <List.Item>
            <List.Item.Meta
              description={
                <Button type="primary" onClick={switchChain}>
                  Switch to {networkId === 100 ? 'Mainnet' : 'xDai'}
                </Button>
              }
            />
          </List.Item>
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
                title={nativeCurrency}
              />
            </List.Item>
          )}
          {process.env.REACT_APP_NOTIFICATIONS_API_URL && networkId && (
            <List.Item>
              <List.Item.Meta
                description={
                  <>
                    <EnhancedEmailForm
                      onSubmit={submitEmail}
                      formID={EMAIL_FORM_ID}
                      initialValues={fetchedEmailSettings}
                    />
                    <Alert
                      message={
                        <div>
                          Note that it is necessary to subscribe for each chain.
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: '15px', marginTop: '-15px' }}
                    />
                    {emailStatus && emailStatus !== 'loading' && (
                      <Alert
                        closable
                        type={emailStatus}
                        message={
                          emailStatus === 'error'
                            ? 'Failed to save settings.'
                            : 'Settings saved.'
                        }
                        style={{ marginBottom: '15px' }}
                      />
                    )}
                    <Button
                      key="submitEmail"
                      type="primary"
                      form={EMAIL_FORM_ID}
                      htmlType="submit"
                      loading={emailStatus === 'loading'}
                      disabled={emailStatus === 'loading'}
                    >
                      {emailStatus === 'loading' ? '' : 'Save'}
                    </Button>
                  </>
                }
                title="Email Notifications"
              />
            </List.Item>
          )}
        </List>
      }
      placement="bottomRight"
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
