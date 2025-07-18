import React from 'react'
import styled from 'styled-components'
import { Form, Input } from 'antd'
import { Field } from 'formik'

const BasedDepositContainer = styled.div`
  display: flex;
  align-items: center;
`

const PGTCRDepositInput = ({
  label,
  name,
  error,
  touched,
  hasFeedback,
  disabled
}) => (
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
              addonAfter={'sDAI'}
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
