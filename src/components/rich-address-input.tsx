import { Form, Input, Select } from 'antd'
import { Field } from 'formik'
import React from 'react'
import {
  references,
  parseRichAddress,
  RichAddress
} from '../utils/rich-address'

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

const RichAddressInput: React.FC<{
  label: string
  name: string
  error: string
  touched: boolean
  hasFeedback: boolean
  disabled: boolean
  style: any
  values: any
  setFieldValue: any
}> = p => {
  const value = p.values[p.name]
  const changeAddressType = (addressType: string) => {
    const richAddress = parseRichAddress(value)
    const address = richAddress ? richAddress.address : ''
    const newRichAddress = `${addressType}:${address}`
    p.setFieldValue(p.name, newRichAddress)
  }

  console.log(p)

  const changeAddress = ({ target }: any) => {
    const richAddress = parseRichAddress(value)
    const addressType = richAddress
      ? `${richAddress.reference.namespaceId}:${richAddress.reference.id}`
      : defaultAddressType
    const address = target.value
    const newRichAddress = `${addressType}:${address}`
    p.setFieldValue(p.name, newRichAddress)
  }

  return (
    <Field
      validate={(value: any) => {
        const richAddress = parseRichAddress(value) as RichAddress
        if (!richAddress.passedTest) {
          return 'Invalid format'
        }
        return null
      }}
      name={p.name}
      style={{ style: p.style }}
    >
      {({ field }: any) => {
        const richAddress = parseRichAddress(field.value)
        const addressType = richAddress
          ? `${richAddress.reference.namespaceId}:${richAddress.reference.id}`
          : defaultAddressType
        const address = richAddress ? richAddress.address : ''
        return (
          <Form.Item
            label={p.label}
            validateStatus={p.error && p.touched ? 'error' : undefined}
            help={p.error && p.touched ? p.error : ''}
            hasFeedback={p.hasFeedback}
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
              placeholder="Address"
              disabled={p.disabled}
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
