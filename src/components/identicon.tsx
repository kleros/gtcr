import React, { useEffect, useState, useCallback } from 'react'
import { Popover, Form, Input, Button, Alert } from 'components/ui'
import { withFormik, Field, FormikProps, FieldProps } from 'formik'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useDisconnect } from 'wagmi'
import ReactBlockies from 'react-blockies'
import styled from 'styled-components'
import * as yup from 'yup'
import localforage from 'localforage'
import ETHAddress from './eth-address'
import ETHAmount from './eth-amount'
import { ethers, BigNumber } from 'ethers'

const { randomBytes } = ethers.utils
import useNativeCurrency from 'hooks/native-currency'

const StyledDiv = styled.div`
  height: 32px;
  line-height: 100%;
  width: 32px;
`
const StyledReactBlockies = styled(ReactBlockies)<{ large?: boolean }>`
  border-radius: ${({ large }) => (large ? '4' : '16')}px;
`

const PopoverMenu = styled.div`
  margin: -12px -16px;
  min-width: 260px;
`

const MenuSection = styled.div`
  padding: 12px 16px;

  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  }
`

const MenuLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.textSecondary};
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const StyledAlertInfo = styled(Alert)`
  margin-bottom: 16px;
  margin-top: 8px;
`

const StyledAlertPopup = styled(Alert)`
  margin-bottom: 16px !important;
`

const StyledSaveButton = styled(Button)`
  margin-top: 8px;
`

interface EmailFormValues {
  email?: string
}

interface EmailFormOuterProps {
  formID: string
  onSubmit: (values: EmailFormValues) => void
  initialValues?: { email?: string } | null
}

const EmailForm = ({
  formID,

  // Formik bag
  handleSubmit,
}: EmailFormOuterProps & FormikProps<EmailFormValues>) => (
  <Form id={formID} onSubmit={handleSubmit} layout="vertical">
    <Field name="email">
      {({
        field,
        form: { errors, touched },
      }: FieldProps<string | undefined, EmailFormValues>) => (
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

const validationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Invalid email.')
    .required('A valid email is required.'),
})

const EnhancedEmailForm = withFormik<EmailFormOuterProps, EmailFormValues>({
  validationSchema,
  handleSubmit: (values, { props: { onSubmit } }) => {
    onSubmit(values)
  },
  mapPropsToValues: ({ initialValues }) => ({ ...initialValues }),
})(EmailForm)

const EMAIL_FORM_ID = 'emailForm'
const CACHED_SETTINGS = 'CACHED_SETTINGS'

const StyledDisconnectButton = styled(Button)`
  width: 100%;
  background: transparent !important;
  color: ${({ theme }) => theme.errorColor} !important;
  border-color: ${({ theme }) => theme.errorColor} !important;

  &:hover,
  &:focus {
    color: #fff !important;
    background-color: ${({ theme }) => theme.errorColor} !important;
    border-color: ${({ theme }) => theme.errorColor} !important;
  }
`

interface IdenticonProps {
  className?: string
  large?: boolean
}

const Identicon = ({ className, large }: IdenticonProps) => {
  const { account, library, networkId } = useWeb3Context()
  const { disconnect } = useDisconnect()
  const nativeCurrency = useNativeCurrency()

  const [balance, setBalance] = useState<BigNumber>()
  const [emailStatus, setEmailStatus] = useState<
    'loading' | 'success' | 'error'
  >()
  const [fetchedEmailSettings, setFetchedEmailSettings] = useState<{
    email: string
  } | null>()
  useEffect(() => {
    if (!library || !account) return
    ;(async () => {
      setBalance(await library.getBalance(account))
    })()
  }, [library, account])

  // Fetch current email settings from local storage, if available.
  useEffect(() => {
    if (!process.env.REACT_APP_NOTIFICATIONS_API_URL || !account || !networkId)
      return
    ;(async () => {
      const cachedSettings = await localforage.getItem<{ email: string }>(
        CACHED_SETTINGS,
      )
      setFetchedEmailSettings(cachedSettings)
    })()
  }, [account, networkId])

  const submitEmail = useCallback(
    ({ email }: EmailFormValues) => {
      setEmailStatus('loading')
      const data = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'salt', type: 'bytes32' },
          ],
          Settings: [{ name: 'email', type: 'string' }],
        },
        primaryType: 'Settings',
        message: { email },
        domain: {
          name: `${process.env.REACT_APP_NOTIFICATIONS_API_URL}`,
          chainId: networkId,
          version: 1,
          salt: BigNumber.from(randomBytes(32)).toHexString(),
        },
      }
      if (!library) {
        setEmailStatus('error')
        return
      }
      try {
        library
          .getSigner()
          .provider.send('personal_sign', [account, JSON.stringify(data)])
          .then(async (signature) => {
            try {
              const response = await (
                await fetch(
                  `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/email-settings`,
                  {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      signature,
                      data,
                    }),
                  },
                )
              ).json()
              if (response.status === 'success') {
                localforage.setItem(CACHED_SETTINGS, { email })
                setEmailStatus('success')
              } else {
                setEmailStatus('error')
                console.error(response)
              }
            } catch (err) {
              setEmailStatus('error')
              console.error(err)
            }
            return null
          })
          .catch((err) => {
            console.error(err)
            setEmailStatus('error')
          })
      } catch (err) {
        setEmailStatus('error')
        console.error(err)
      }
    },
    [account, library, networkId],
  )

  if (!account) return null

  const blockiesContent = (
    <StyledDiv className={className} id="react-blockies-identicon">
      <StyledReactBlockies
        large={large}
        scale={large ? 7 : 4}
        seed={account.toLowerCase()}
        size={large ? 14 : 8}
      />
    </StyledDiv>
  )

  return large ? (
    blockiesContent
  ) : (
    <Popover
      arrowPointAtCenter
      content={
        <PopoverMenu>
          <MenuSection>
            <MenuLabel>Address</MenuLabel>
            <ETHAddress address={account} />
          </MenuSection>
          {account && (
            <MenuSection>
              <MenuLabel>{nativeCurrency}</MenuLabel>
              <ETHAmount amount={balance} decimals={4} />
            </MenuSection>
          )}
          {process.env.REACT_APP_NOTIFICATIONS_API_URL && networkId && (
            <MenuSection>
              <MenuLabel>Email Notifications</MenuLabel>
              <EnhancedEmailForm
                onSubmit={submitEmail}
                formID={EMAIL_FORM_ID}
                initialValues={fetchedEmailSettings}
              />
              <StyledAlertInfo
                message={
                  <div>
                    Note that it is necessary to subscribe for each chain.
                  </div>
                }
                type="info"
                showIcon
              />
              {emailStatus && emailStatus !== 'loading' && (
                <StyledAlertPopup
                  closable
                  type={emailStatus}
                  message={
                    emailStatus === 'error'
                      ? 'Failed to save settings.'
                      : 'Settings saved.'
                  }
                />
              )}
              <StyledSaveButton
                key="submitEmail"
                type="primary"
                form={EMAIL_FORM_ID}
                htmlType="submit"
                loading={emailStatus === 'loading'}
                disabled={emailStatus === 'loading'}
              >
                {emailStatus === 'loading' ? '' : 'Save'}
              </StyledSaveButton>
            </MenuSection>
          )}
          <MenuSection>
            <StyledDisconnectButton onClick={() => disconnect()}>
              Disconnect
            </StyledDisconnectButton>
          </MenuSection>
        </PopoverMenu>
      }
      placement="bottomRight"
      trigger="click"
    >
      {blockiesContent}
    </Popover>
  )
}

export default Identicon
