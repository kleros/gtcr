import { Form, Input } from 'components/ui'
import { Field } from 'formik'
import React from 'react'
import { ItemTypes } from '@kleros/gtcr-encoder'

interface CustomInputProps {
  label?: React.ReactNode
  name: string
  placeholder?: string
  error?: string
  touched?: boolean
  addonAfter?: React.ReactNode
  hasFeedback?: boolean
  type?: string
  step?: number
  disabled?: boolean
  style?: React.CSSProperties
}

const CustomInput = ({
  label,
  name,
  placeholder,
  error,
  touched,
  addonAfter,
  hasFeedback,
  type,
  step,
  disabled,
  style,
}: CustomInputProps) => (
  <Field name={name} style={style}>
    {({ field }: { field: Record<string, unknown> }) => (
      <Form.Item
        label={label}
        validateStatus={error && touched ? 'error' : undefined}
        help={error && touched ? error : ''}
        hasFeedback={hasFeedback}
      >
        {type === ItemTypes.NUMBER ? (
          <Input
            addonAfter={addonAfter}
            placeholder={placeholder}
            step={step || 0.0001}
            disabled={disabled}
            {...field}
          />
        ) : (
          <Input
            addonAfter={addonAfter}
            placeholder={placeholder}
            disabled={disabled}
            {...field}
          />
        )}
      </Form.Item>
    )}
  </Field>
)

export default CustomInput
