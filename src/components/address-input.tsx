import React from 'react'
import styled from 'styled-components'
import { Form, Input } from 'components/ui'
import { Field, type FieldProps } from 'formik'
import { namespaces } from 'utils/rich-address'

const StyledInput = styled(Input)`
  text-transform: lowercase;
`

const AddressInput: React.FC<{
  label?: React.ReactNode
  name: string
  placeholder?: string
  error?: string | null
  touched?: boolean
  hasFeedback?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}> = (p) => (
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
    {({ field }: FieldProps) => (
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
