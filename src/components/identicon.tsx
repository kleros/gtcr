import React, { useEffect, useState, useCallback } from 'react'
import { Popover, Form, Input, Alert } from 'components/ui'
import { withFormik, Field, FormikProps, FieldProps } from 'formik'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useDisconnect } from 'wagmi'
import ReactBlockies from 'react-blockies'
import styled from 'styled-components'
import * as yup from 'yup'
import localforage from 'localforage'
import { ethers, BigNumber } from 'ethers'
import useNativeCurrency from 'hooks/native-currency'
import { Button, Label, Small, Stack } from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import ETHAddress from './eth-address'
import TokenAmount from './token-amount'

const { randomBytes } = ethers.utils

/*
 * Account avatar and menu. The blockies avatar sits in a hairline ring (a
 * rounded tile at the large size). The menu leads with the balance as its
 * figure, then the address with copy and explorer, the email form, and a
 * quiet disconnect.
 */

const AvatarFrame = styled.span<{ $large?: boolean }>`
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  width: ${({ $large }) => ($large ? '98px' : '32px')};
  height: ${({ $large }) => ($large ? '98px' : '32px')};
  overflow: hidden;
  border-radius: ${({ $large }) =>
    $large ? 'var(--radius-lg)' : 'var(--radius-pill)'};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px var(--glass-border),
      inset 0 1px 0 var(--glass-highlight);
    pointer-events: none;
  }

  canvas {
    display: block;
  }
`

const AvatarButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  cursor: pointer;
  transition:
    box-shadow var(--motion),
    transform var(--motion);

  &:hover,
  &[aria-expanded='true'] {
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`

const Menu = styled.div`
  margin: -12px -14px;
  min-width: 280px;
`

const MenuSection = styled(Stack)`
  padding: 14px 16px;

  &:not(:last-child) {
    box-shadow: inset 0 -1px 0 var(--glass-border);
  }
`

const Balance = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

/** The currency after the figure: half its size, quiet, on its baseline. */
const BalanceUnit = styled.span`
  margin-left: 0.2em;
  color: var(--color-muted);
  font-size: 0.5em;
  font-weight: 400;
  letter-spacing: 0;
`

const Disconnect = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: transparent;
  color: var(--status-off);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
  cursor: pointer;
  transition:
    background var(--motion),
    border-color var(--motion);

  &:hover {
    border-color: color-mix(in srgb, var(--status-off) 40%, transparent);
    background: var(--status-off-soft);
  }
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
          <Input
            placeholder="you@example.org"
            aria-label="Email address"
            {...field}
          />
        </Form.Item>
      )}
    </Field>
  </Form>
)

const validationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Enter a valid email address.')
    .required('An email address is required.'),
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

interface IdenticonProps {
  className?: string
  large?: boolean
}

const Identicon = ({ className, large }: IdenticonProps) => {
  const { account, library, networkId } = useWeb3Context()
  const { disconnect } = useDisconnect()
  const nativeCurrency = useNativeCurrency()

  const [menuOpen, setMenuOpen] = useState(false)
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

  const avatar = (
    <AvatarFrame
      className={className}
      $large={large}
      id="react-blockies-identicon"
      aria-hidden="true"
    >
      <ReactBlockies
        scale={large ? 7 : 4}
        seed={account.toLowerCase()}
        size={large ? 14 : 8}
      />
    </AvatarFrame>
  )

  if (large) return avatar

  return (
    <Popover
      content={
        <Menu>
          <MenuSection $gap={6}>
            <Label $tone="faint">Balance</Label>
            <Balance>
              {/* Rounded to 4 decimals: wei would print up to 18. */}
              <TokenAmount amount={balance} precision={4} />
              {balance && <BalanceUnit>{nativeCurrency}</BalanceUnit>}
            </Balance>
            <ETHAddress address={account} />
          </MenuSection>
          {process.env.REACT_APP_NOTIFICATIONS_API_URL && networkId && (
            <MenuSection $gap={8}>
              <Label $tone="faint">Email notifications</Label>
              <EnhancedEmailForm
                onSubmit={submitEmail}
                formID={EMAIL_FORM_ID}
                initialValues={fetchedEmailSettings}
              />
              <Small $muted>Subscriptions are per chain.</Small>
              {emailStatus && emailStatus !== 'loading' && (
                <Alert
                  closable
                  type={emailStatus}
                  message={
                    emailStatus === 'error'
                      ? 'Settings could not be saved.'
                      : 'Settings saved.'
                  }
                />
              )}
              <Button
                type="submit"
                form={EMAIL_FORM_ID}
                $variant="primary"
                $size="sm"
                disabled={emailStatus === 'loading'}
              >
                {emailStatus === 'loading' ? 'Saving…' : 'Save'}
              </Button>
            </MenuSection>
          )}
          <MenuSection>
            <Disconnect type="button" onClick={() => disconnect()}>
              <CurateIcon name="wallet" size={15} />
              Disconnect
            </Disconnect>
          </MenuSection>
        </Menu>
      }
      placement="bottomRight"
      trigger="click"
      visible={menuOpen}
      onVisibleChange={setMenuOpen}
    >
      <AvatarButton
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {avatar}
      </AvatarButton>
    </Popover>
  )
}

export default Identicon
