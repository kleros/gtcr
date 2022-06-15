import { Form, Input, Select } from 'antd'
import { Field } from 'formik'
import React from 'react'
import { references, parseRichAddress } from '../utils/helpers/rich-address'

const { Option } = Select

const chainOptions = references.map(reference => (
  <Option
    key={`${reference.namespaceId}:${reference.id}`}
    value={`${reference.namespaceId}:${reference.id}`}
  >
    {reference.name}
  </Option>
))

const defaultAddressType = `${references[0].namespaceId}:${references[0].id}`

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
    const richAddress = parseRichAddress(value)
    const address = richAddress ? richAddress.address : ''
    const newRichAddress = `${addressType}:${address}`
    setFieldValue(name, newRichAddress)
  }

  const changeAddress = ({ target }) => {
    const richAddress = parseRichAddress(value)
    const addressType = richAddress
      ? `${richAddress.reference.namespaceId}:${richAddress.reference.id}`
      : defaultAddressType
    const address = target.value
    const newRichAddress = `${addressType}:${address}`
    setFieldValue(name, newRichAddress)
  }

  return (
    <Field name={name} style={{ style }}>
      {({ field }) => {
        const richAddress = parseRichAddress(field.value)
        const addressType = richAddress
          ? `${richAddress.reference.namespaceId}:${richAddress.reference.id}`
          : defaultAddressType
        const address = richAddress ? richAddress.address : ''
        return (
          <Form.Item
            label={label}
            validateStatus={error && touched ? 'error' : undefined}
            help={error && touched ? error : ''}
            disabled={disabled}
            hasFeedback={hasFeedback}
          >
            <Select
              defaultValue={defaultAddressType}
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
