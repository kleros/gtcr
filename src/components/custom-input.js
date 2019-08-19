import { Form, Input, InputNumber } from 'antd'
import { Field } from 'formik'
import React from 'react'
import PropTypes from 'prop-types'
import itemTypes from '../utils/item-types'

const CustomInput = ({
  label,
  name,
  placeholder,
  error,
  touched,
  addonAfter,
  hasFeedback,
  type
}) => (
  <Field name={name}>
    {({ field }) => (
      <Form.Item
        label={label}
        validateStatus={error && touched ? 'error' : undefined}
        help={error && touched ? error : ''}
        hasFeedback={hasFeedback}
      >
        {type === itemTypes.NUMBER ? (
          <InputNumber
            addonAfter={addonAfter}
            placeholder={placeholder}
            step={0.0001}
            {...field}
          />
        ) : (
          <Input addonAfter={addonAfter} {...field} placeholder={placeholder} />
        )}
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
  hasFeedback: PropTypes.bool,
  type: PropTypes.oneOf(Object.values(itemTypes))
}

CustomInput.defaultProps = {
  label: null,
  placeholder: '',
  error: null,
  touched: null,
  addonAfter: null,
  hasFeedback: null,
  type: null
}

export default CustomInput
