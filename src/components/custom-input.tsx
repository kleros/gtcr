import { Form, Input } from 'components/ui'
import { Field } from 'formik'
import React from 'react'
import { ItemTypes } from '@kleros/gtcr-encoder'

interface CustomInputProps {
  label?: string | React.ReactNode | null
  name: string
  placeholder?: string
  error?: string | null
  touched?: boolean | null
  addonAfter?: React.ReactNode | null
  hasFeedback?: boolean | null
  type?: string
  step?: number | null
  disabled?: boolean | null
  style?: React.CSSProperties | null
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
        hasFeedback={hasFeedback ?? undefined}
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
