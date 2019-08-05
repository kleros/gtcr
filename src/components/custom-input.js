import { Form, Input } from 'antd'
import { Field } from 'formik'
import React from 'react'
import PropTypes from 'prop-types'

const CustomInput = ({
  label,
  name,
  placeholder,
  error,
  touched,
  addonAfter,
  hasFeedback
}) => (
  <Field name={name}>
    {({ field }) => (
      <Form.Item
        label={label}
        validateStatus={error && touched ? 'error' : undefined}
        help={error && touched ? error : ''}
        hasFeedback={hasFeedback}
      >
        <Input addonAfter={addonAfter} {...field} placeholder={placeholder} />
      </Form.Item>
    )}
  </Field>
)

CustomInput.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placeholder: PropTypes.string,
  error: PropTypes.string,
  touched: PropTypes.bool,
  addonAfter: PropTypes.node,
  hasFeedback: PropTypes.bool
}

CustomInput.defaultProps = {
  label: null,
  placeholder: '',
  error: null,
  touched: null,
  addonAfter: null,
  hasFeedback: null
}

export default CustomInput
