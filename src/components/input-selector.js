import React from 'react'
import { Form, Switch, Input } from 'antd'
import PropTypes from 'prop-types'
import itemTypes from '../utils/item-types.js'
import CustomInput from './custom-input.js'
import { Field } from 'formik'

const InputSelector = ({ type, setFieldValue, ...props }) => {
  const { name, label } = props
  switch (type) {
    case itemTypes.TEXT:
    case itemTypes.ADDRESS:
    case itemTypes.NUMBER:
      return <CustomInput {...props} />
    case itemTypes.BOOLEAN:
      return (
        <Field name={name}>
          {({ field }) => (
            <Form.Item label={label} style={{ display: 'flex' }}>
              <Switch
                {...field}
                onChange={value => setFieldValue(name, value)}
              />
            </Form.Item>
          )}
        </Field>
      )
    case itemTypes.LONGTEXT:
      return (
        <Field name={name}>
          {({ field }) => (
            <Form.Item label={label}>
              <Input.TextArea autosize={{ minRows: 2 }} {...field} />
            </Form.Item>
          )}
        </Field>
      )
    default:
      throw new Error(`Unhandled input type ${type}`)
  }
}

InputSelector.propTypes = {
  type: PropTypes.oneOf(Object.values(itemTypes))
}

export default InputSelector
