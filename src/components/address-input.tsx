import React from 'react'
import styled from 'styled-components'
import { Form, Input } from 'antd'
import { Field } from 'formik'
import { namespaces } from 'utils/rich-address'

const StyledInput = styled(Input)`
  text-transform: lowercase;
`

const AddressInput: React.FC<{
  label: string
  name: string
  placeholder: string
  error: string
  touched: boolean
  hasFeedback: boolean
  disabled: boolean
  style: any
}> = p => (
  <Field
    name={p.name}
    style={p.style}
    validate={(value: string) => {
      // namespaces[0] is eip155
      const valid = namespaces[0].test(value)
      if (!valid) return 'Invalid format'

      return null
    }}
  >
    {({ field }: any) => (
      <Form.Item
        label={p.label}
        validateStatus={p.error && p.touched ? 'error' : undefined}
        help={p.error && p.touched ? p.error : ''}
        hasFeedback={p.hasFeedback}
      >
        <StyledInput
          placeholder={p.placeholder}
          disabled={p.disabled}
          {...field}
        />
      </Form.Item>
    )}
  </Field>
)

export default AddressInput
