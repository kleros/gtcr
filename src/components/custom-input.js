import { Form, Input } from 'antd'
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
  type,
  step,
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
        {type === itemTypes.NUMBER ? (
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

CustomInput.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placeholder: PropTypes.string,
  error: PropTypes.string,
  touched: PropTypes.bool,
  addonAfter: PropTypes.node,
  hasFeedback: PropTypes.bool,
  type: PropTypes.oneOf(Object.values(itemTypes)),
  step: PropTypes.number,
  disabled: PropTypes.bool,
  // eslint-disable-next-line react/require-default-props
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.object
}

CustomInput.defaultProps = {
  label: null,
  placeholder: '',
  error: null,
  touched: null,
  addonAfter: null,
  hasFeedback: null,
  type: null,
  step: null,
  disabled: null,
  style: null
}

export default CustomInput
