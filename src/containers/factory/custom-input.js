import { Form, Input } from 'antd'
import { Field } from 'formik'
import React from 'react'

const FormItem = Form.Item

export default ({ label, name, placeholder, error, touched, addonAfter, hasFeedback }) => (
  <Field name={name}>
    {({ field }) => (
      <FormItem
        label={label}
        validateStatus={error && touched ? 'error' : undefined}
        help={error && touched ? error : ''}
        hasFeedback={hasFeedback}
      >
        <Input addonAfter={addonAfter} {...field} placeholder={placeholder} />
      </FormItem>
    )}
  </Field>
)
