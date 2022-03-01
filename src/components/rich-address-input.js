import { Form, Input, Select } from 'antd'
import { Field } from 'formik'
import React from 'react'
import { nameToInfoMap, parseRichAddress } from '../utils/rich-address'

const { Option } = Select

const chainOptions = Object.values(nameToInfoMap).map(infoObject => (
  <Option key={infoObject.shortName} value={infoObject.shortName}>
    {infoObject.name}
  </Option>
))

const RichAddressInput = ({
  label,
  name,
  error,
  touched,
  addonAfter,
  hasFeedback,
  disabled,
  style,
  values,
  setFieldValue
}) => {
  const value = values[name]
  const changeAddressType = addressType => {
    const { address } = parseRichAddress(value)
    const newRichAddress = `${addressType}:${address}`
    setFieldValue(name, newRichAddress)
  }

  const changeAddress = ({ target }) => {
    const { addressType } = parseRichAddress(value)
    const address = target.value
    const newRichAddress = `${addressType}:${address}`
    setFieldValue(name, newRichAddress)
  }

  return (
    <Field name={name} style={{ style }}>
      {({ field }) => {
        const { addressType, address } = parseRichAddress(field.value)
        return (
          <Form.Item
            label={label}
            validateStatus={error && touched ? 'error' : undefined}
            help={error && touched ? error : ''}
            disabled={disabled}
            hasFeedback={hasFeedback}
          >
            <Select
              defaultValue="eth"
              {...field}
              value={addressType}
              onChange={changeAddressType}
            >
              {chainOptions}
            </Select>
            <Input
              addonAfter={addonAfter}
              placeholder="Address"
              disabled={disabled}
              {...field}
              value={address}
              onChange={changeAddress}
            />
          </Form.Item>
        )
      }}
    </Field>
  )
}

export default RichAddressInput
