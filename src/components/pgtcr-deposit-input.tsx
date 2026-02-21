import React from 'react'
import styled from 'styled-components'
import { Form, Input } from 'components/ui'
import { Field } from 'formik'

const BasedDepositContainer = styled.div`
  display: flex;
  align-items: center;
`

interface PGTCRDepositInputProps {
  label?: string | React.ReactNode | null
  name: string
  error?: string | null
  touched?: boolean | null
  hasFeedback?: boolean | null
  disabled?: boolean | null
  tokenSymbol?: string
}

const PGTCRDepositInput = ({
  label,
  name,
  error,
  touched,
  hasFeedback,
  disabled,
  tokenSymbol = 'tokens'
}: PGTCRDepositInputProps) => (
  <div>
    <Field name={name}>
      {({ field }) => (
        <Form.Item
          label={label}
          validateStatus={error && touched ? 'error' : undefined}
          help={error && touched ? error : ''}
          hasFeedback={hasFeedback}
        >
          <BasedDepositContainer>
            <Input
              addonAfter={tokenSymbol}
              placeholder="0.1"
              step={0.0001}
              disabled={disabled}
              {...field}
            />
          </BasedDepositContainer>
        </Form.Item>
      )}
    </Field>
  </div>
)

export default PGTCRDepositInput
