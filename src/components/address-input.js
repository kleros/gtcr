import { Form, Input } from 'antd'
import { Field } from 'formik'
import React from 'react'
import PropTypes from 'prop-types'

const AddressInput = ({
  label,
  name,
  placeholder,
  error,
  touched,
  addonAfter,
  hasFeedback,
  disabled,
  style
}) => (
  <Field name={name} style={style}>
    {({ field }) => (
      <Form.Item
        label={label}
        validateStatus={error && touched ? 'error' : undefined}
        help={error && touched ? error : ''}
        hasFeedback={hasFeedback}
      >
        <Input
          addonAfter={addonAfter}
          placeholder={placeholder}
          disabled={disabled}
          style={{ textTransform: 'lowercase' }}
          {...field}
        />
      </Form.Item>
    )}
  </Field>
)

AddressInput.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placeholder: PropTypes.string,
  error: PropTypes.string,
  touched: PropTypes.bool,
  addonAfter: PropTypes.node,
  hasFeedback: PropTypes.bool,
  disabled: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.object
}

AddressInput.defaultProps = {
  label: null,
  placeholder: '',
  error: null,
  touched: null,
  addonAfter: null,
  hasFeedback: null,
  disabled: null,
  style: null
}

export default AddressInput
